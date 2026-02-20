import telebot
import pandas as pd
import PIL.Image
import io
import json
import datetime
import requests
from google import genai
from google.genai import types as genai_types
from telebot import types as tg_types

# --- LIBRERIE FIREBASE ---
import firebase_admin
from firebase_admin import credentials, firestore

# --- CONFIGURAZIONE ---
TELEGRAM_TOKEN = "8386712893:AAGyp1svuwpyhrGTgT9_O5LtRdPFcJ_oosM"
GEMINI_KEY = "AIzaSyBkuToH6EP8__W3UIJGs90HEIFyIcMQG9M"

# INCOLLA QUI IL TUO UID ESATTO COPIATO DALLA TUA WEB APP!
MERCHANT_UID = "JACPnjT5RafLrOF6bl0Y82Qwgcr2" 

# INIZIALIZZA FIREBASE
cred = credentials.Certificate("firebase-key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

bot = telebot.TeleBot(TELEGRAM_TOKEN)
client = genai.Client(api_key=GEMINI_KEY)

# --- LOGICA SALVATAGGIO DATI (SU FIREBASE CLOUD!) ---
def update_db_generic(items, fornitore_info):
    count = 0
    for item in items:
        prodotto = str(item.get('prodotto')).lower().strip()
        quantita = item.get('quantita', 1)
        prezzo = item.get('prezzo', 0)
        scadenza = item.get('scadenza')
        if scadenza == "null" or scadenza == "": scadenza = None
        
        tipo = item.get('tipo', 'carico')
        valore_finale = quantita if tipo == 'carico' else -quantita
        
        # 1. Salva nel Magazzino Segreto di Firebase
        doc_ref = db.collection("VfindApp_inventory").document()
        doc_ref.set({
            "merchantId": MERCHANT_UID,
            "prodotto": prodotto,
            "quantita": valore_finale,
            "prezzo_unitario": prezzo,
            "fornitore": fornitore_info,
            "data_scadenza": scadenza,
            "data_inserimento": firestore.SERVER_TIMESTAMP
        })
        count += 1
        
        # 2. Crea un'Asta in automatico se scade a breve!
        if scadenza:
            try:
                scad_date = datetime.datetime.strptime(scadenza, "%Y-%m-%d")
                if (scad_date - datetime.datetime.now()).days <= 3:
                    db.collection("VfindApp_posts").add({
                        "title": f"⏳ {prodotto.capitalize()} in scadenza!",
                        "text": f"Attenzione! Ho appena caricato {quantita} pezzi di {prodotto.capitalize()} in scadenza il {scadenza}. Passate in negozio o prenotatelo qui!",
                        "category": "Cibo",
                        "score": 1, "upvotedBy": [MERCHANT_UID], "downvotedBy": [], "comments": [], "notifiedUsers": [],
                        "timestamp": datetime.datetime.now().strftime("%H:%M"),
                        "authorName": "La tua Bottega", # Verrà sovrascritto se modifichi il profilo web
                        "authorPic": "https://cdn-icons-png.flaticon.com/512/1040/1040065.png",
                        "authorId": MERCHANT_UID,
                        "isMerchant": True,
                        "isAuction": True,
                        "reservedBy": None
                    })
            except Exception as e:
                print("Errore auto-post:", e)

    return count

def get_inventory_dataframe():
    """Scarica i dati dal Cloud e li trasforma in un DataFrame Pandas"""
    docs = db.collection("VfindApp_inventory").where("merchantId", "==", MERCHANT_UID).stream()
    data = [doc.to_dict() for doc in docs]
    if not data:
        return pd.DataFrame()
    return pd.DataFrame(data)

# --- LOGICA AI VISION E BARCODE ---
def analyze_invoice_image(image_bytes):
    img = PIL.Image.open(io.BytesIO(image_bytes))
    prompt = """
    Analizza questa foto di una bolla o scontrino. 
    Estrai: prodotto, quantità, prezzo e, SE PRESENTE, la data di scadenza.
    Restituisci SOLO un array JSON nel formato:
    [{"prodotto": "Nome", "quantita": 10, "prezzo": 5.50, "scadenza": "YYYY-MM-DD"}]
    Se la scadenza non c'è, scrivi null. Formato data rigoroso: YYYY-MM-DD.
    """
    response = client.models.generate_content(model='gemini-2.0-flash', contents=[prompt, img])
    raw_text = response.text.replace('```json', '').replace('```', '').strip()
    return json.loads(raw_text)

def get_product_info(barcode):
    url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        if data['status'] == 1:
            return data['product'].get('product_name', 'Prodotto Sconosciuto')
    except: pass
    return None

# --- GESTORE TELEGRAM: START E MENU ---
@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = tg_types.ReplyKeyboardMarkup(row_width=2, resize_keyboard=True)
    markup.add(
        tg_types.KeyboardButton('📊 Vedi Scorte'), tg_types.KeyboardButton('🗓️ Scadenze'),
        tg_types.KeyboardButton('📸 Carica Bolla'), tg_types.KeyboardButton('🤳 Scansiona Barcode'),
        tg_types.KeyboardButton('🎤 Nota Vocale'), tg_types.KeyboardButton('❓ Aiuto')
    )
    bot.reply_to(message, "🏪 **Sistema Magazzino AI Cloud Attivo**\nCosa desideri fare oggi?", reply_markup=markup, parse_mode="Markdown")

# --- GESTORE: VEDI SCORTE ---
@bot.message_handler(func=lambda message: message.text == '📊 Vedi Scorte')
def menu_scorte(message):
    df = get_inventory_dataframe()
    if df.empty:
        bot.reply_to(message, "📭 Il magazzino è attualmente vuoto.")
        return
    
    # Somma aggregata
    df_grouped = df.groupby('prodotto')['quantita'].sum().reset_index()
    
    res = "📦 **Stato Attuale Scorte:**\n\n"
    for _, row in df_grouped.iterrows():
        if row['quantita'] <= 0: continue
        status = "✅" if row['quantita'] > 5 else "⚠️"
        res += f"{status} {row['prodotto'].capitalize()}: **{int(row['quantita'])}**\n"
    
    bot.reply_to(message, res, parse_mode="Markdown")

# --- GESTORE: FOTO (CARICO MERCE) ---
@bot.message_handler(content_types=['photo'])
@bot.message_handler(func=lambda message: message.text == '📸 Carica Bolla')
def handle_photo_step(message):
    if message.text == '📸 Carica Bolla':
        bot.reply_to(message, "Invia pure la foto della bolla o dello scontrino!")
        return

    msg = bot.reply_to(message, "⏳ Analisi immagine in corso...")
    try:
        file_info = bot.get_file(message.photo[-1].file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        data = analyze_invoice_image(downloaded_file)
        num_items = update_db_generic(data, f"Foto: {file_info.file_path[-10:]}")
        
        res_text = f"✅ **Caricamento Cloud completato!**\n📦 Articoli registrati: {num_items}\n\n"
        for item in data:
            res_text += f"- {item['prodotto']} (x{item['quantita']})\n"
        bot.edit_message_text(res_text, message.chat.id, msg.message_id, parse_mode="Markdown")
    except Exception as e:
        bot.edit_message_text(f"❌ Errore lettura immagine: {e}", message.chat.id, msg.message_id)

# --- GESTORE: VOCE (CARICO/SCARICO) ---
@bot.message_handler(content_types=['voice'])
@bot.message_handler(func=lambda message: message.text == '🎤 Nota Vocale')
def handle_voice_step(message):
    if message.text == '🎤 Nota Vocale':
        bot.reply_to(message, "Tieni premuto il microfono e dimmi cosa hai caricato o venduto (e se vuoi, quando scade)!")
        return

    msg = bot.reply_to(message, "🎤 Ascolto in corso...")
    try:
        file_info = bot.get_file(message.voice.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        today = pd.Timestamp.now().strftime("%Y-%m-%d")
        
        prompt = f"""
        Oggi è il {today}. Sei un assistente di magazzino.
        Analizza l'audio. Estrai prodotti, quantità e se è CARICO o SCARICO.
        ISTRUZIONI SCADENZA:
        - Se l'utente dice una data, calcola la data esatta formato YYYY-MM-DD.
        - Se non dice nulla sulla scadenza, metti null.
        OUTPUT JSON RICHIESTO:
        [
          {{"prodotto": "nome", "quantita": 10, "tipo": "carico", "scadenza": "YYYY-MM-DD"}},
          {{"prodotto": "altro", "quantita": 5, "tipo": "scarico", "scadenza": null}}
        ]
        """
        
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[prompt, genai_types.Part.from_bytes(data=downloaded_file, mime_type='audio/ogg')]
        )
        
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(raw_text)
        
        if data:
            update_db_generic(data, "Nota Vocale")
            res = "✅ **Movimenti Cloud Registrati:**\n"
            for i in data:
                icon = "📥" if i.get('tipo') == 'carico' else "📤"
                scad_txt = f" (Scadenza: {i['scadenza']})" if i.get('scadenza') else ""
                res += f"{icon} {i['prodotto']} ({i['quantita']} unità){scad_txt}\n"
            bot.edit_message_text(res, message.chat.id, msg.message_id, parse_mode="Markdown")
        else:
            bot.edit_message_text("🤔 Non ho capito i prodotti. Riprova!", message.chat.id, msg.message_id)
    except Exception as e:
        bot.edit_message_text(f"❌ Errore audio: {e}", message.chat.id, msg.message_id)

# --- GESTORE: AIUTO ---
@bot.message_handler(func=lambda message: message.text == '❓ Aiuto')
def help_command(message):
    help_text = """
    📖 **Guida Rapida:**
    1. **Foto:** Carica una bolla per aggiungere merce.
    2. **Voce:** Di' "Vendute 3 pere" o "Aggiungi 5 mele".
    3. **Scorte:** Visualizza il riepilogo totale.
    4. **Barcode:** Scansiona un codice a barre per aggiungere un prodotto specifico.
    
    Tutto viene sincronizzato in tempo reale con la Web App di VfindApp!
    """
    bot.reply_to(message, help_text, parse_mode="Markdown")

# --- GESTORE: BARCODE (SCANNER) ---
@bot.message_handler(func=lambda message: message.text == '🤳 Scansiona Barcode')
def barcode_step(message):
    msg = bot.reply_to(message, "📸 Fammi una foto chiara del codice a barre (EAN).")
    bot.register_next_step_handler(msg, process_barcode_photo)

def process_barcode_photo(message):
    if not message.photo:
        bot.reply_to(message, "❌ Non hai inviato una foto. Riprova cliccando il pulsante.")
        return

    msg_wait = bot.reply_to(message, "🔍 Decodifica codice a barre in corso...")

    try:
        file_info = bot.get_file(message.photo[-1].file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        
        prompt = """
        Guarda questa foto. Trova il codice a barre (EAN-13 o EAN-8).
        Restituisci SOLO il numero del codice a barre. Nient'altro.
        Se non c'è nessun codice, restituisci "NULL".
        """
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=[prompt, genai_types.Part.from_bytes(data=downloaded_file, mime_type='image/jpeg')]
        )
        barcode_number = response.text.strip()
        
        if "NULL" in barcode_number or len(barcode_number) < 8:
            bot.edit_message_text("❌ Non ho trovato codici a barre validi nella foto.", message.chat.id, msg_wait.message_id)
            return
            
        nome_prodotto = get_product_info(barcode_number)
        if not nome_prodotto:
            nome_prodotto = f"Articolo EAN-{barcode_number}"
            bot.send_message(message.chat.id, f"⚠️ Prodotto non trovato nel database mondiale. Lo salvo come '{nome_prodotto}'.")
        
        item_data = [{"prodotto": nome_prodotto, "quantita": 1, "tipo": "carico"}]
        update_db_generic(item_data, f"Barcode: {barcode_number}")
        
        bot.edit_message_text(f"✅ **Prodotto Aggiunto!**\n\n🔢 Codice: `{barcode_number}`\n🏷️ Nome: **{nome_prodotto}**\n📦 Quantità: +1", 
                              message.chat.id, msg_wait.message_id, parse_mode="Markdown")
                              
    except Exception as e:
        bot.edit_message_text(f"❌ Errore: {e}", message.chat.id, msg_wait.message_id)

# --- GESTORE: SCADENZE ---
@bot.message_handler(func=lambda message: message.text == '🗓️ Scadenze')
def check_expiry(message):
    df = get_inventory_dataframe()
    if df.empty or 'data_scadenza' not in df.columns:
        return bot.reply_to(message, "Nessun prodotto con scadenza registrata.")
    
    df_scad = df.dropna(subset=['data_scadenza']).copy()
    if df_scad.empty:
        return bot.reply_to(message, "Nessun prodotto con scadenza registrata.")

    df_scad['data_scadenza'] = pd.to_datetime(df_scad['data_scadenza'])
    oggi = pd.Timestamp.now().normalize()
    limite = oggi + pd.Timedelta(days=7)
    
    in_scadenza = df_scad[(df_scad['data_scadenza'] >= oggi) & (df_scad['data_scadenza'] <= limite)]
    in_scadenza = in_scadenza.groupby(['prodotto', 'data_scadenza'])['quantita'].sum().reset_index()
    
    if in_scadenza.empty or in_scadenza['quantita'].sum() <= 0:
        return bot.reply_to(message, "✅ Nessun prodotto in giacenza in scadenza nei prossimi 7 giorni!")
        
    res = "⏰ **PRODOTTI IN SCADENZA (Prossimi 7gg):**\n\n"
    for _, row in in_scadenza.iterrows():
        if row['quantita'] > 0:
            res += f"⚠️ {row['prodotto'].capitalize()}: **{int(row['quantita'])} pezzi** entro il {row['data_scadenza'].strftime('%d/%m')}\n"
    
    bot.reply_to(message, res, parse_mode="Markdown")

print("🤖 Bot Cloud in ascolto...")
bot.infinity_polling()