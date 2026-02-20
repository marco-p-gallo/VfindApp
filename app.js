import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove, query, orderBy, increment, deleteDoc, getDoc, setDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnmR_HM0r-K_B0h4MwZGAmVYiY3qyyvgI",
  authDomain: "vfindapp-46cf7.firebaseapp.com",
  projectId: "vfindapp-46cf7",
  storageBucket: "vfindapp-46cf7.firebasestorage.app",
  messagingSenderId: "1097817597800",
  appId: "1:1097817597800:web:b83d6503c22c23a97958dd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentFilter = 'Tutte';
let allPosts = []; 
let allInventory = []; 
let currentUser = null; 
let userUnsubscribe = null; 
let inventoryUnsubscribe = null; 

let isCurrentUserMerchant = false; 
let currentUserShopName = "";
let currentUserShopAddress = "";
let currentUserShopLat = null; 
let currentUserShopLon = null; 

let currentUserRatingTotal = 0;
let currentUserRatingCount = 0;
let myNotifications = [];
let isNotifOpen = false;

let myShoppingList = [];
let isShoppingSearchActive = false; 
let currentSort = 'score'; 
let userLat = null;
let userLon = null;
let isDashboardActive = false;

// VARIABILI CHAT
let activeChatId = null;
let activeChatUnsubscribe = null;
let myChats = [];
let isInboxOpen = false;

window.login = function() { signInWithPopup(auth, provider).catch(error => console.error(error)); }
window.logout = function() { signOut(auth); }

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-pic').src = user.photoURL;
        if(!isDashboardActive) document.getElementById('create-post-box').style.display = 'flex';
        document.getElementById('login-prompt').style.display = 'none';
        document.getElementById('shopping-list-section').style.display = 'block';
        document.getElementById('notification-container').style.display = 'block';

        userUnsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                isCurrentUserMerchant = data.isMerchant || false;
                currentUserShopName = data.shopName || "";
                currentUserShopAddress = data.shopAddress || "";
                currentUserShopLat = data.shopLat || null;
                currentUserShopLon = data.shopLon || null;
                currentUserRatingTotal = data.ratingTotal || 0;
                currentUserRatingCount = data.ratingCount || 0;
                myNotifications = data.notifications || [];
                renderNotifications();
                
                if (isCurrentUserMerchant) {
                    document.getElementById('merchant-btn').style.display = 'none';
                    document.getElementById('merchant-badge-header').style.display = 'inline-flex';
                    document.getElementById('shop-name-display').innerText = currentUserShopName;
                    document.getElementById('merchant-dashboard-btn').style.display = 'block'; 
                    const auctionLabel = document.getElementById('auction-label');
                    if(auctionLabel) auctionLabel.style.display = 'inline-flex';
                } else {
                    document.getElementById('merchant-btn').style.display = 'block';
                    document.getElementById('merchant-badge-header').style.display = 'none';
                    document.getElementById('merchant-dashboard-btn').style.display = 'none'; 
                    const auctionLabel = document.getElementById('auction-label');
                    if(auctionLabel) auctionLabel.style.display = 'none';
                }

                myShoppingList = data.shoppingList || [];
                renderShoppingList();
            }
            if(isDashboardActive) renderDashboard(); else renderPosts(); 
        });

        inventoryUnsubscribe = onSnapshot(collection(db, "VfindApp_inventory"), (snapshot) => {
            allInventory = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if(data.merchantId === currentUser.uid) { allInventory.push({ id: doc.id, ...data }); }
            });
            if(isDashboardActive) renderDashboard();
        });

        // Ascolta tutte le chat in cui sei coinvolto (per l'inbox)
        onSnapshot(query(collection(db, "VfindApp_chats"), where("participants", "array-contains", currentUser.uid)), (snap) => {
            myChats = [];
            snap.forEach(doc => myChats.push({ id: doc.id, ...doc.data() }));
            myChats.sort((a,b) => b.lastUpdated - a.lastUpdated);
            renderInbox();
        });

    } else {
        if (userUnsubscribe) userUnsubscribe();
        if (inventoryUnsubscribe) inventoryUnsubscribe(); 
        if (activeChatUnsubscribe) activeChatUnsubscribe();
        closeChatWindow();
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('create-post-box').style.display = 'none';
        document.getElementById('login-prompt').style.display = 'block';
        document.getElementById('shopping-list-section').style.display = 'none';
        document.getElementById('notification-container').style.display = 'none';
        document.getElementById('merchant-dashboard-btn').style.display = 'none';
        isCurrentUserMerchant = false; myShoppingList = []; myNotifications = []; allInventory = []; myChats = [];
        hideDashboard(); renderPosts();
    }
});

// ============================================================================
// MODULO CHAT PRIVATA
// ============================================================================

window.toggleInbox = function() {
    const dropdown = document.getElementById('inbox-dropdown');
    isInboxOpen = !isInboxOpen;
    dropdown.style.display = isInboxOpen ? 'block' : 'none';
    if(isNotifOpen) { isNotifOpen = false; document.getElementById('notification-dropdown').style.display = 'none'; }
}

function renderInbox() {
    const listEl = document.getElementById('inbox-list');
    if (!listEl) return;
    if (myChats.length === 0) {
        listEl.innerHTML = '<div style="padding:15px; text-align:center; color:#787C7E; font-size:0.85rem;">Nessuna chat attiva.</div>';
        return;
    }

    listEl.innerHTML = myChats.map(chat => {
        // Trova il nome dell'ALTRA persona
        const otherId = chat.participants.find(id => id !== currentUser.uid);
        const otherName = chat.names ? chat.names[otherId] : "Utente";
        const lastMsg = chat.messages.length > 0 ? chat.messages[chat.messages.length-1].text : "Nessun messaggio";
        
        return `
        <div class="inbox-item" onclick="openExistingChat('${chat.id}', '${otherName.replace(/'/g, "\\'")}')">
            <b style="color:#03a9f4;">${otherName}</b><br>
            <small style="color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${lastMsg}</small>
        </div>`;
    }).join('');
}

window.startNewChat = async function(otherId, otherName) {
    if (!currentUser) return alert("Devi fare l'accesso!");
    if (currentUser.uid === otherId) return alert("Non puoi scriverti da solo!");

    // Ordina gli ID per creare un Document ID unico e univoco per questi due utenti
    const chatId = currentUser.uid < otherId ? `${currentUser.uid}_${otherId}` : `${otherId}_${currentUser.uid}`;
    
    const chatRef = doc(db, "VfindApp_chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    // Se la chat non esiste, la crea
    if (!chatSnap.exists()) {
        const myName = isCurrentUserMerchant ? currentUserShopName : currentUser.displayName;
        await setDoc(chatRef, {
            participants: [currentUser.uid, otherId],
            names: { [currentUser.uid]: myName, [otherId]: otherName },
            messages: [],
            lastUpdated: Date.now()
        });
    }

    openExistingChat(chatId, otherName);
}

window.openExistingChat = function(chatId, otherName) {
    document.getElementById('inbox-dropdown').style.display = 'none';
    isInboxOpen = false;
    document.getElementById('chat-widget').style.display = 'flex';
    document.getElementById('chat-header-name').innerText = otherName;
    
    activeChatId = chatId;
    if(activeChatUnsubscribe) activeChatUnsubscribe();

    activeChatUnsubscribe = onSnapshot(doc(db, "VfindApp_chats", chatId), (docSnap) => {
        if(docSnap.exists()) {
            renderChatMessages(docSnap.data().messages || []);
        }
    });
}

window.closeChatWindow = function() {
    document.getElementById('chat-widget').style.display = 'none';
    activeChatId = null;
    if(activeChatUnsubscribe) { activeChatUnsubscribe(); activeChatUnsubscribe = null; }
}

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(m => {
        const isMe = m.senderId === currentUser.uid;
        const bubbleClass = isMe ? 'chat-sent' : 'chat-received';
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return `<div class="chat-bubble ${bubbleClass}">
            ${m.text}<br><span style="font-size:0.65rem; color:#888; float:right; margin-top:4px;">${timeStr}</span>
        </div>`;
    }).join('');
    // Scorri in basso
    container.scrollTop = container.scrollHeight;
}

window.sendChatMessage = async function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !activeChatId) return;

    input.value = '';
    const newMessage = {
        senderId: currentUser.uid,
        text: text,
        timestamp: Date.now()
    };

    const chatRef = doc(db, "VfindApp_chats", activeChatId);
    await updateDoc(chatRef, {
        messages: arrayUnion(newMessage),
        lastUpdated: Date.now()
    });
    
    // (Opzionale: manda una notifica campanella all'altro utente che ha ricevuto un messaggio)
    const chatSnap = await getDoc(chatRef);
    if(chatSnap.exists()) {
        const otherId = chatSnap.data().participants.find(id => id !== currentUser.uid);
        const myName = isCurrentUserMerchant ? currentUserShopName : currentUser.displayName;
        sendNotification(otherId, `💬 Nuovo messaggio da <b>${myName}</b>! Apri l'inbox per rispondere.`);
    }
}

// ============================================================================
// ALTRE LOGICHE (Dashboard, GPS, Notifiche, Rendering)
// ============================================================================

window.showDashboard = function() {
    if (!currentUser || !isCurrentUserMerchant) return;
    isDashboardActive = true; isShoppingSearchActive = false;
    document.querySelectorAll('#subVfindApp-list li').forEach(item => item.classList.remove('active'));
    document.getElementById('merchant-dashboard-btn').classList.add('active');
    
    document.getElementById('feed').style.display = 'none'; document.getElementById('create-post-box').style.display = 'none'; document.getElementById('sort-section').style.display = 'none'; document.getElementById('dashboard-area').style.display = 'block';
    renderDashboard();
}

window.hideDashboard = function() {
    isDashboardActive = false;
    document.getElementById('dashboard-area').style.display = 'none'; document.getElementById('feed').style.display = 'block';
    if(currentUser) document.getElementById('create-post-box').style.display = 'flex'; document.getElementById('sort-section').style.display = 'flex';
}

function renderDashboard() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;
    let html = `<div style="background:#fff3cd; padding:10px; border-radius:5px; margin-bottom:15px; font-size:0.85rem;">🔑 Il tuo UID esatto è: <b style="user-select:all;">${currentUser.uid}</b></div>`;
    html += `<h3 style="color:#03a9f4; border-bottom:2px solid #03a9f4; padding-bottom:5px;">📦 Magazzino & Vetrina (dal Bot)</h3>`;
    
    if (allInventory.length === 0) {
        html += "<p style='color:#787C7E; margin-bottom: 30px;'>Il magazzino è vuoto. Carica le merci dal Bot Telegram!</p>";
    } else {
        let groupedInv = {};
        allInventory.forEach(item => {
            const prod = item.prodotto;
            if(!groupedInv[prod]) groupedInv[prod] = { qt: 0, prezzo: item.prezzo_unitario || 0, in_vetrina: false };
            groupedInv[prod].qt += Number(item.quantita);
            if (item.in_vetrina) groupedInv[prod].in_vetrina = true;
            if (item.prezzo_unitario > 0) groupedInv[prod].prezzo = item.prezzo_unitario;
        });

        html += `<table class="dashboard-table" style="margin-bottom: 30px;"><tr><th>Prodotto</th><th>Qt</th><th>Prezzo</th><th>Mostra in Vetrina</th></tr>`;
        for (const [prod, data] of Object.entries(groupedInv)) {
            if (data.qt > 0) {
                const btnClass = data.in_vetrina ? 'vetrina-btn active' : 'vetrina-btn';
                const btnText = data.in_vetrina ? '👁️ In Vetrina' : 'Nascondi';
                html += `<tr><td><b>${prod.toUpperCase()}</b></td><td style="font-size: 1.1rem;">${data.qt}</td><td>€${data.prezzo.toFixed(2)}</td><td><button class="${btnClass}" onclick="toggleVetrina('${prod}', ${!data.in_vetrina})">${btnText}</button></td></tr>`;
            }
        }
        html += `</table>`;
    }

    html += `<h3 style="color:#e91e63; border-bottom:2px solid #e91e63; padding-bottom:5px;">📢 I tuoi Annunci Pubblici</h3>`;
    const myItems = allPosts.filter(p => p.authorId === currentUser.uid);
    if (myItems.length === 0) {
        html += "<p style='color:#787C7E;'>Non hai ancora pubblicato annunci in bacheca.</p>";
    } else {
        html += `<table class="dashboard-table"><tr><th>Annuncio</th><th>Stato</th><th>Azione</th></tr>`;
        myItems.forEach(item => {
            const isReserved = item.reservedBy !== null && item.reservedBy !== undefined;
            const statusHtml = isReserved ? `<span class="status-badge status-reserved">🔒 Prenotato da <b>${item.reservedByName}</b></span>` : `<span class="status-badge status-available">🟢 Libero</span>`;
            const typeBadge = item.isAuction ? `<span style="color:#ff5722; font-size:0.75rem; font-weight:bold;">⏳ Asta Anti-Spreco</span><br>` : '';
            html += `<tr><td>${typeBadge}<b style="font-size:1.1rem;">${item.title}</b></td><td>${statusHtml}</td><td><button onclick="deletePost('${item.id}')" style="background:#f44336; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;"><i class="fas fa-trash"></i> Ritira</button></td></tr>`;
        });
        html += `</table>`;
    }
    content.innerHTML = html;
}

window.toggleVetrina = async function(prodotto, newState) {
    if (!currentUser) return;
    const q = query(collection(db, "VfindApp_inventory"), where("merchantId", "==", currentUser.uid), where("prodotto", "==", prodotto));
    const snap = await getDocs(q);
    snap.forEach(async (d) => { await updateDoc(doc(db, "VfindApp_inventory", d.id), { in_vetrina: newState }); });
}

window.openVetrina = async function(merchantId, shopName) {
    document.getElementById('vetrina-modal').style.display = 'flex';
    document.getElementById('vetrina-title').innerText = `🏪 Vetrina di: ${shopName}`;
    const content = document.getElementById('vetrina-content');
    content.innerHTML = '<p style="text-align:center;">Recupero prodotti dalla vetrina...</p>';

    const q = query(collection(db, "VfindApp_inventory"), where("merchantId", "==", merchantId), where("in_vetrina", "==", true));
    const snap = await getDocs(q);
    let vetrinaItems = {};
    snap.forEach(doc => {
        const data = doc.data(); const prod = data.prodotto;
        if(!vetrinaItems[prod]) vetrinaItems[prod] = { qt: 0, prezzo: data.prezzo_unitario || 0 };
        vetrinaItems[prod].qt += Number(data.quantita);
        if (data.prezzo_unitario > 0) vetrinaItems[prod].prezzo = data.prezzo_unitario;
    });

    let html = ''; const keys = Object.keys(vetrinaItems);
    if(keys.length === 0) { html = '<p style="color:#787C7E; text-align:center;">Nessun prodotto esposto.</p>'; } 
    else {
        keys.forEach(prod => {
            const data = vetrinaItems[prod];
            if(data.qt > 0) {
                html += `<div style="border:1px solid #eee; padding:15px; border-radius:8px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; background:#fdfdfd;">
                    <div><b style="font-size:1.1rem;">${prod.toUpperCase()}</b><br><span style="color:#e91e63; font-weight:bold; font-size:1.2rem;">€${data.prezzo.toFixed(2)}</span><span style="color:#787C7E; font-size:0.85rem; margin-left:10px;">(Disp: ${data.qt})</span></div>
                    <div>
                        <button onclick="startNewChat('${merchantId}', '${shopName.replace(/'/g, "\\'")}')" class="chat-btn" style="margin-right:5px;" title="Chiedi Info">💬</button>
                        <button onclick="bookFromVetrina('${merchantId}', '${prod}')" style="background:#03a9f4; color:white; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer;">🛒 Ordina</button>
                    </div>
                </div>`;
            }
        });
    }
    content.innerHTML = html;
}

window.bookFromVetrina = async function(merchantId, prodotto) {
    if (!currentUser) { alert("Devi fare l'accesso!"); return; }
    if (confirm(`Vuoi ordinare ${prodotto.toUpperCase()}?`)) {
        sendNotification(merchantId, `🛍️ <b>ORDINE DA VETRINA:</b> ${currentUser.displayName} ha appena ordinato <b>${prodotto.toUpperCase()}</b>!`);
        alert("🎉 Ordine inviato!"); document.getElementById('vetrina-modal').style.display = 'none';
    }
}

// Altre Funzioni
window.enableLocation = function() {
    if (!navigator.geolocation) return;
    const btn = document.getElementById('enable-location-btn'); btn.innerText = "📍 Rilevamento...";
    navigator.geolocation.getCurrentPosition((position) => {
        userLat = position.coords.latitude; userLon = position.coords.longitude;
        btn.innerText = "📍 Posizione Attiva"; btn.style.backgroundColor = "#e8f5e9"; btn.style.borderColor = "#4CAF50"; btn.style.color = "#2e7d32";
        recalcDistances(); renderPosts();
    }, () => { alert("Posizione non consentita"); btn.innerText = "📍 Attiva Posizione"; });
}
function recalcDistances() {
    if (!userLat || !userLon) return;
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; const dLat = (lat2-lat1)*(Math.PI/180); const dLon = (lon2-lon1)*(Math.PI/180);
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }
    allPosts.forEach(post => { if (post.shopLat && post.shopLon) post.distance = getDistance(userLat, userLon, post.shopLat, post.shopLon); else post.distance = 99999; });
}
window.changeSort = function(sortType) { currentSort = sortType; renderPosts(); }

window.toggleNotifications = async function() {
    const dropdown = document.getElementById('notification-dropdown'); isNotifOpen = !isNotifOpen; dropdown.style.display = isNotifOpen ? 'block' : 'none';
    if(isInboxOpen) { isInboxOpen = false; document.getElementById('inbox-dropdown').style.display = 'none'; }
    if (isNotifOpen && myNotifications.some(n => !n.read) && currentUser) {
        await updateDoc(doc(db, "users", currentUser.uid), { notifications: myNotifications.map(n => ({...n, read: true})) });
    }
}
function renderNotifications() {
    const listEl = document.getElementById('notification-list'); const badge = document.getElementById('notification-badge'); if (!listEl) return;
    const unread = myNotifications.filter(n => !n.read).length;
    if (unread > 0) { badge.style.display = 'block'; badge.innerText = unread; } else { badge.style.display = 'none'; }
    if (myNotifications.length === 0) { listEl.innerHTML = '<div style="padding:15px; text-align:center; color:#787C7E; font-size:0.85rem;">Nessuna notifica.</div>'; return; }
    listEl.innerHTML = [...myNotifications].reverse().map(n => `<div style="padding: 10px; border-bottom: 1px solid #eee; font-size: 0.85rem; background: ${n.read ? 'white' : '#fce4ec'};">${n.text}</div>`).join('');
}
async function sendNotification(targetUserId, message) {
    if (!targetUserId || targetUserId === currentUser.uid) return; 
    try { await updateDoc(doc(db, "users", targetUserId), { notifications: arrayUnion({ text: message, read: false, timestamp: Date.now() }) }); } catch(e) {}
}

window.addShoppingItem = async function() {
    if (!currentUser) return; const input = document.getElementById('new-item-input'); const item = input.value.trim().toLowerCase();
    if (!item) return; await setDoc(doc(db, "users", currentUser.uid), { shoppingList: arrayUnion(item) }, { merge: true }); input.value = '';
}
window.removeShoppingItem = async function(item) { if (!currentUser) return; await updateDoc(doc(db, "users", currentUser.uid), { shoppingList: arrayRemove(item) }); }
window.renderShoppingList = function() {
    const listEl = document.getElementById('shopping-list-items'); if (!listEl) return;
    if (myShoppingList.length === 0) { listEl.innerHTML = '<li style="color:#787C7E; font-size: 0.8rem; margin-top: 5px;">La tua lista è vuota.</li>'; return; }
    listEl.innerHTML = myShoppingList.map(item => `<li class="shopping-item"><span>${item}</span><span class="remove-item-btn" onclick="removeShoppingItem('${item}')">✖</span></li>`).join('');
}
window.searchMyList = function() {
    isShoppingSearchActive = true; hideDashboard();
    document.querySelectorAll('#subVfindApp-list li').forEach(item => item.classList.remove('active'));
    document.getElementById('search-input').value = ''; renderPosts(); 
}

window.registerMerchant = async function() {
    if (!currentUser) return;
    const shopName = prompt("Nome negozio?"); const shopAddress = prompt("Indirizzo fisico?");
    let lat = null, lon = null;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shopAddress)}`);
        const data = await res.json(); if(data && data.length > 0) { lat = parseFloat(data[0].lat); lon = parseFloat(data[0].lon); }
    } catch(e) {}
    await setDoc(doc(db, "users", currentUser.uid), { isMerchant: true, shopName: shopName, shopAddress: shopAddress, shopLat: lat, shopLon: lon, ratingTotal: 0, ratingCount: 0 }, { merge: true });
}

window.rateMerchant = async function(merchantId) {
    if (!currentUser) return;
    const stars = parseInt(prompt("Stelle (1-5)?")); if (isNaN(stars) || stars < 1 || stars > 5) return;
    const mRef = doc(db, "users", merchantId); const mSnap = await getDoc(mRef);
    if (mSnap.exists()) { await updateDoc(mRef, { ratingTotal: (mSnap.data().ratingTotal || 0) + stars, ratingCount: (mSnap.data().ratingCount || 0) + 1 }); alert("Salvato!"); }
}

window.addPost = async function() {
    if (!currentUser) return;
    const title = document.getElementById('post-title').value; const text = document.getElementById('post-text').value; const category = document.getElementById('post-category').value;
    if (title.trim() === '') return;
    const isAuction = document.getElementById('post-is-auction') ? document.getElementById('post-is-auction').checked : false;
    let currentAvg = "Nuovo"; if (isCurrentUserMerchant && currentUserRatingCount > 0) { currentAvg = (currentUserRatingTotal / currentUserRatingCount).toFixed(1); }

    await addDoc(collection(db, "VfindApp_posts"), {
        title: title, text: text, category: category, score: 1, upvotedBy: [currentUser.uid], downvotedBy: [], comments: [], notifiedUsers: [],
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName,
        authorPic: currentUser.photoURL, authorId: currentUser.uid, isMerchant: isCurrentUserMerchant, shopAddress: isCurrentUserMerchant ? currentUserShopAddress : "",
        shopLat: isCurrentUserMerchant ? currentUserShopLat : null, shopLon: isCurrentUserMerchant ? currentUserShopLon : null,
        merchantRating: currentAvg, isAuction: isAuction, reservedBy: null, reservedByName: null
    });
    document.getElementById('post-title').value = ''; document.getElementById('post-text').value = ''; if(document.getElementById('post-is-auction')) document.getElementById('post-is-auction').checked = false; 
}

window.deletePost = async function(postId) { if (confirm("Sei sicuro?")) { await deleteDoc(doc(db, "VfindApp_posts", postId)); } }
window.deleteComment = async function(postId, commentIndex) {
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
    if (postSnap.exists()) { let comments = postSnap.data().comments || []; comments.splice(commentIndex, 1); await updateDoc(postRef, { comments: comments }); }
}
window.vote = async function(postId, change) {
    if (!currentUser) return;
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef); if (!postSnap.exists()) return;
    const postData = postSnap.data(); let newScore = postData.score; let upv = [...(postData.upvotedBy || [])]; let dnv = [...(postData.downvotedBy || [])]; const userId = currentUser.uid;
    if (change === 1) { if (upv.includes(userId)) { upv = upv.filter(id => id !== userId); newScore -= 1; } else { upv.push(userId); newScore += 1; if (dnv.includes(userId)) { dnv = dnv.filter(id => id !== userId); newScore += 1; } } } 
    else if (change === -1) { if (dnv.includes(userId)) { dnv = dnv.filter(id => id !== userId); newScore += 1; } else { dnv.push(userId); newScore -= 1; if (upv.includes(userId)) { upv = upv.filter(id => id !== userId); newScore -= 1; } } }
    await updateDoc(postRef, { score: newScore, upvotedBy: upv, downvotedBy: dnv });
}
window.addComment = async function(postId) {
    if (!currentUser) return;
    const input = document.getElementById(`comment-input-${postId}`); const text = input.value; if (text.trim() === '') return;
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        await updateDoc(postRef, { comments: arrayUnion({ text: text, authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName, authorPic: currentUser.photoURL, isMerchant: isCurrentUserMerchant, authorId: currentUser.uid, shopAddress: isCurrentUserMerchant ? currentUserShopAddress : "", isOffer: false }) });
        sendNotification(postSnap.data().authorId, `💬 <b>${currentUser.displayName}</b> ha commentato "${postSnap.data().title}".`);
    }
    input.value = ''; 
}
window.makeOffer = async function(postId) {
    if (!currentUser) return;
    const importo = prompt("Offerta (€)?"); if (!importo || isNaN(importo)) return;
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        await updateDoc(postRef, { comments: arrayUnion({ text: `💶 <b>Offerto €${importo}</b>`, authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName, authorPic: currentUser.photoURL, isMerchant: isCurrentUserMerchant, authorId: currentUser.uid, shopAddress: isCurrentUserMerchant ? currentUserShopAddress : "", isOffer: true }) });
        sendNotification(postSnap.data().authorId, `💶 <b>${currentUser.displayName}</b> ha offerto <b>€${importo}</b> per "${postSnap.data().title}"!`);
    }
}
window.toggleNotify = async function(postId) {
    if (!currentUser) return;
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef); if (!postSnap.exists()) return;
    let notif = [...(postSnap.data().notifiedUsers || [])]; const userId = currentUser.uid;
    if (notif.includes(userId)) { notif = notif.filter(id => id !== userId); } else { notif.push(userId); alert("🔔 Avviso attivato!"); }
    await updateDoc(postRef, { notifiedUsers: notif });
}
window.bookPost = async function(postId) {
    if (!currentUser) return;
    if (confirm("Vuoi prenotare?")) {
        const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
        await updateDoc(postRef, { reservedBy: currentUser.uid, reservedByName: currentUser.displayName });
        if (postSnap.exists()) sendNotification(postSnap.data().authorId, `🎉 <b>VENDUTO!</b> ${currentUser.displayName} ha prenotato "${postSnap.data().title}".`);
        alert("🎉 Prenotato!");
    }
}

window.filterCategory = function(event, category) {
    isShoppingSearchActive = false; currentFilter = category; hideDashboard(); 
    document.querySelectorAll('#subVfindApp-list li').forEach(item => item.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active'); renderPosts();
}

window.renderPosts = renderPosts;

const q = query(collection(db, "VfindApp_posts"));
onSnapshot(q, (snapshot) => {
    allPosts = []; snapshot.forEach((doc) => { allPosts.push({ id: doc.id, ...doc.data() }); });
    recalcDistances(); if(isDashboardActive) renderDashboard(); else renderPosts();
});

function renderPosts() {
    const feed = document.getElementById('feed'); if (!feed) return; feed.innerHTML = '';
    const searchText = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '';
    if (currentSort === 'distance') { allPosts.sort((a, b) => (a.distance || 99999) - (b.distance || 99999)); } else { allPosts.sort((a, b) => (b.score || 0) - (a.score || 0)); }

    const filteredPosts = allPosts.filter(post => {
        if (isShoppingSearchActive) { return myShoppingList.some(item => ((post.title || '') + ' ' + (post.text || '')).toLowerCase().includes(item)); } 
        else { return (currentFilter === 'Tutte' || post.category === currentFilter) && ((post.title && post.title.toLowerCase().includes(searchText)) || (post.text && post.text.toLowerCase().includes(searchText))); }
    });

    if (isShoppingSearchActive && filteredPosts.length === 0) { feed.innerHTML = `<div style="text-align:center; padding: 40px; color: #787C7E;"><h2>Nessun risultato 😢</h2></div>`; return; }

    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = post.isAuction ? 'post auction-post' : (post.isMerchant ? 'post merchant-post' : 'post');
        
        const commentsHTML = (post.comments || []).map((c, index) => {
            const badgeHTML = c.isMerchant ? `<span class="merchant-badge">🏪 Negozio</span>` : '';
            const deleteBtn = (currentUser && c.authorId === currentUser.uid) ? `<button onclick="deleteComment('${post.id}', ${index})" class="delete-btn" style="margin-left: auto;"><i class="fas fa-trash"></i></button>` : '';
            return `<div class="${c.isOffer ? 'comment offer-comment' : (c.isMerchant ? 'comment merchant-comment' : 'comment')}" style="display: flex; flex-direction: column;"><div style="display:flex; align-items:center; gap:5px; margin-bottom: 4px; width: 100%; flex-wrap: wrap;"><img src="${c.authorPic}" style="width:16px; height:16px; border-radius:50%"><b style="font-size:0.8rem">${c.authorName}</b> ${badgeHTML} ${deleteBtn}</div><span>${c.text}</span></div>`;
        }).join('');

        const isReserved = post.reservedBy !== null && post.reservedBy !== undefined;
        const reservedHTML = isReserved ? `<div class="reserved-badge">🔒 Riservato per ${post.reservedByName}</div>` : '';
        const bookBtnHTML = (currentUser && !isReserved && post.isMerchant && post.authorId !== currentUser.uid) ? `<button class="book-btn" onclick="bookPost('${post.id}')" title="Prenota">🤝 Prenota</button>` : '';
        const rateBtnHTML = (currentUser && post.isMerchant && post.authorId !== currentUser.uid) ? `<button class="rate-btn" onclick="rateMerchant('${post.authorId}')">⭐ Valuta</button>` : '';
        // NUOVO: PULSANTE CONTATTA PRIVATAMENTE
        const chatBtnHTML = (currentUser && post.isMerchant && post.authorId !== currentUser.uid) ? `<button class="chat-btn" onclick="startNewChat('${post.authorId}', '${post.authorName.replace(/'/g, "\\'")}')" title="Scrivi al negoziante">💬 Contatta</button>` : '';

        const distanceHTML = (userLat && post.distance && post.distance !== 99999) ? `<div style="font-size: 0.85rem; color: #03a9f4; font-weight:bold; margin-bottom:5px;">📍 A ${post.distance.toFixed(1)} km da te</div>` : '';

        const commentInputHTML = (currentUser && !isReserved) ? `
            <div class="comment-input-area" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input type="text" id="comment-input-${post.id}" placeholder="Rispondi..." style="flex: 1; min-width: 150px;">
                <button onclick="addComment('${post.id}')">Commenta</button>
                <button class="offer-btn" onclick="makeOffer('${post.id}')">💶 Offerta</button>
                ${bookBtnHTML} ${chatBtnHTML} ${rateBtnHTML}
            </div>
        ` : (isReserved ? `<p style="color:#9c27b0; font-weight:bold; margin-top:10px;">Prodotto prenotato.</p>` : `<p style="font-size: 0.8rem; color: #787C7E; margin-top: 10px;">Fai il login.</p>`);

        const deleteBtnHTML = (currentUser && post.authorId === currentUser.uid) ? `<button onclick="deletePost('${post.id}')" class="delete-btn"><i class="fas fa-trash"></i></button>` : '';
        const postBadgeHTML = post.isMerchant ? `<span class="merchant-badge" onclick="openVetrina('${post.authorId}', '${post.authorName.replace(/'/g, "\\'")}')">🏪 Negozio</span> <span style="color:#ffc107; font-weight:bold; margin-left:5px;">${post.merchantRating} ⭐</span>` : '';

        postElement.innerHTML = `
            <div class="vote-column"><button class="vote-btn" onclick="vote('${post.id}', 1)"><i class="fas fa-arrow-up"></i></button><span class="score">${post.score}</span><button class="vote-btn down" onclick="vote('${post.id}', -1)"><i class="fas fa-arrow-down"></i></button></div>
            <div class="post-content">
                <div class="post-header"><span class="subVfindApp-tag">v/${post.category}</span> • ${post.timestamp || 'poco fa'} ${post.isAuction ? `<span class="auction-badge">⏳ Asta Anti-Spreco</span>` : ''}</div>
                ${distanceHTML}
                <div class="post-author" style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><img src="${post.authorPic}" class="author-pic"><span class="author-name">${post.authorName}</span>${postBadgeHTML}</div>${deleteBtnHTML}</div>
                ${reservedHTML}
                <h3 class="post-title" style="margin-top: 10px;">${post.title}</h3>
                <p class="post-text">${post.text}</p>
                <div class="comments-section">${commentsHTML} ${commentInputHTML}</div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}

// SMART COMPARATOR (Lasciato in fondo)
const GEMINI_API_KEY = "AIzaSyBkuToH6EP8__W3UIJGs90HEIFyIcMQG9M"; 
window.performAISearch = async function() {
    const queryText = document.getElementById('search-input').value.trim();
    if (!queryText) return alert("Scrivi cosa stai cercando!");
    const aiBox = document.getElementById('ai-results-box'); const aiContent = document.getElementById('ai-results-content');
    aiBox.style.display = 'block'; aiContent.innerHTML = '<div style="text-align:center; padding:20px;">L\'AI sta analizzando i magazzini... ⏳</div>';
    try {
        const invSnap = await getDocs(collection(db, "VfindApp_inventory")); let globalInventory = []; invSnap.forEach(doc => globalInventory.push(doc.data()));
        const qLower = queryText.toLowerCase();
        const contextData = {
            offerte_pubbliche: allPosts.filter(p => (p.title||'').toLowerCase().includes(qLower) || (p.text||'').toLowerCase().includes(qLower)).map(p => ({ negozio: p.authorName, offerta: p.title, prezzo: "Vedi dettagli", asta: p.isAuction ? "Sì" : "No" })),
            magazzini_privati: globalInventory.filter(i => (i.prodotto||'').toLowerCase().includes(qLower)).map(i => ({ prodotto: i.prodotto, quantita: i.quantita, prezzo: i.prezzo_unitario, vetrina: i.in_vetrina ? "Sì" : "No" }))
        };
        const promptText = `L'utente cerca: "${queryText}". Dati trovati: ${JSON.stringify(contextData)}. Crea una tabella Markdown riassuntiva e un consiglio.`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
        const data = await response.json();
        aiContent.innerHTML = marked.parse(data.candidates[0].content.parts[0].text);
    } catch (error) { aiContent.innerHTML = `<b>Errore AI:</b> ${error.message}`; }
}

// ============================================================================
// MODULO RESPONSIVE: APRI/CHIUDI MENU MOBILE
// ============================================================================
window.toggleMobileMenu = function() {
    const sidebar = document.getElementById('mobile-sidebar');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    } else {
        sidebar.classList.add('open');
    }
}