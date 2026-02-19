import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove, query, orderBy, increment, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let currentUser = null; 
let userUnsubscribe = null; 

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

// NUOVE VARIABILI PER LA DISTANZA
let currentSort = 'score'; // 'score' oppure 'distance'
let userLat = null;
let userLon = null;

window.login = function() { signInWithPopup(auth, provider).catch(error => console.error(error)); }
window.logout = function() { signOut(auth); }

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-pic').src = user.photoURL;
        document.getElementById('create-post-box').style.display = 'flex';
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
                    const auctionLabel = document.getElementById('auction-label');
                    if(auctionLabel) auctionLabel.style.display = 'inline-flex';
                } else {
                    document.getElementById('merchant-btn').style.display = 'block';
                    document.getElementById('merchant-badge-header').style.display = 'none';
                    const auctionLabel = document.getElementById('auction-label');
                    if(auctionLabel) auctionLabel.style.display = 'none';
                }

                myShoppingList = data.shoppingList || [];
                renderShoppingList();
            } else {
                isCurrentUserMerchant = false;
                myShoppingList = [];
                myNotifications = [];
                document.getElementById('merchant-btn').style.display = 'block';
                document.getElementById('merchant-badge-header').style.display = 'none';
                renderShoppingList();
                renderNotifications();
            }
            renderPosts(); 
        });
    } else {
        if (userUnsubscribe) userUnsubscribe();
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('create-post-box').style.display = 'none';
        document.getElementById('login-prompt').style.display = 'block';
        document.getElementById('shopping-list-section').style.display = 'none';
        document.getElementById('notification-container').style.display = 'none';
        isCurrentUserMerchant = false;
        myShoppingList = [];
        myNotifications = [];
        const auctionLabel = document.getElementById('auction-label');
        if(auctionLabel) auctionLabel.style.display = 'none';
        renderPosts();
    }
});

// --- SISTEMA GPS E DISTANZA ---
window.enableLocation = function() {
    if (!navigator.geolocation) return alert("Browser non supportato per il GPS.");
    
    const btn = document.getElementById('enable-location-btn');
    btn.innerText = "📍 Rilevamento...";
    
    navigator.geolocation.getCurrentPosition((position) => {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;
        
        btn.innerText = "📍 Posizione Attiva";
        btn.style.backgroundColor = "#e8f5e9";
        btn.style.borderColor = "#4CAF50";
        btn.style.color = "#2e7d32";
        
        recalcDistances();
        renderPosts();
    }, () => {
        alert("Devi consentire l'accesso alla posizione dal browser!");
        btn.innerText = "📍 Attiva Posizione";
    });
}

function recalcDistances() {
    if (!userLat || !userLon) return;
    
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2-lat1)*(Math.PI/180);
        const dLon = (lon2-lon1)*(Math.PI/180);
        const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180))*Math.sin(dLon/2)*Math.sin(dLon/2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    }

    allPosts.forEach(post => {
        if (post.shopLat && post.shopLon) {
            post.distance = getDistance(userLat, userLon, post.shopLat, post.shopLon);
        } else {
            post.distance = 99999; 
        }
    });
}

window.changeSort = function(sortType) {
    if (sortType === 'distance' && !userLat) {
        alert("Per ordinare per distanza, clicca prima su '📍 Attiva Posizione' a sinistra!");
        document.getElementById('sort-select').value = 'score';
        return;
    }
    currentSort = sortType;
    renderPosts();
}

// --- NOTIFICHE E LISTA SPESA (Omesso per leggibilità - mantieni identico) ---
window.toggleNotifications = async function() {
    const dropdown = document.getElementById('notification-dropdown');
    isNotifOpen = !isNotifOpen;
    dropdown.style.display = isNotifOpen ? 'block' : 'none';
    const unreadExists = myNotifications.some(n => !n.read);
    if (isNotifOpen && unreadExists && currentUser) {
        const updatedNotifs = myNotifications.map(n => ({...n, read: true}));
        await updateDoc(doc(db, "users", currentUser.uid), { notifications: updatedNotifs });
    }
}
function renderNotifications() {
    const listEl = document.getElementById('notification-list');
    const badge = document.getElementById('notification-badge');
    if (!listEl) return;
    const unreadCount = myNotifications.filter(n => !n.read).length;
    if (unreadCount > 0) { badge.style.display = 'block'; badge.innerText = unreadCount; } else { badge.style.display = 'none'; }
    if (myNotifications.length === 0) { listEl.innerHTML = '<div style="padding:15px; text-align:center; color:#787C7E; font-size:0.85rem;">Nessuna notifica.</div>'; return; }
    const sortedNotifs = [...myNotifications].reverse();
    listEl.innerHTML = sortedNotifs.map(n => `<div style="padding: 10px; border-bottom: 1px solid #eee; font-size: 0.85rem; background: ${n.read ? 'white' : '#fce4ec'};">${n.text}</div>`).join('');
}
async function sendNotification(targetUserId, message) {
    if (!targetUserId || targetUserId === currentUser.uid) return; 
    try { await updateDoc(doc(db, "users", targetUserId), { notifications: arrayUnion({ text: message, read: false, timestamp: Date.now() }) }); } catch(e) {}
}

window.addShoppingItem = async function() {
    if (!currentUser) return;
    const input = document.getElementById('new-item-input'); const item = input.value.trim().toLowerCase();
    if (!item) return; await setDoc(doc(db, "users", currentUser.uid), { shoppingList: arrayUnion(item) }, { merge: true }); input.value = '';
}
window.removeShoppingItem = async function(item) { if (!currentUser) return; await updateDoc(doc(db, "users", currentUser.uid), { shoppingList: arrayRemove(item) }); }
window.renderShoppingList = function() {
    const listEl = document.getElementById('shopping-list-items'); if (!listEl) return;
    if (myShoppingList.length === 0) { listEl.innerHTML = '<li style="color:#787C7E; font-size: 0.8rem; margin-top: 5px;">La tua lista è vuota.</li>'; return; }
    listEl.innerHTML = myShoppingList.map(item => `<li class="shopping-item"><span>${item}</span><span class="remove-item-btn" onclick="removeShoppingItem('${item}')">✖</span></li>`).join('');
}
window.searchMyList = function() {
    if (myShoppingList.length === 0) return alert("La tua lista della spesa è vuota!");
    isShoppingSearchActive = true; document.querySelectorAll('#subVfindApp-list li').forEach(item => item.classList.remove('active'));
    document.getElementById('search-input').value = ''; renderPosts(); 
}

// --- REGISTRAZIONE NEGOZIO E RECENSIONI ---
window.registerMerchant = async function() {
    if (!currentUser) return;
    const shopName = prompt("Come si chiama il tuo negozio? (es. Antica Bottega Torrielli)");
    if (!shopName || shopName.trim() === "") return;
    const shopAddress = prompt("Qual è l'indirizzo fisico? (es. Via San Vincenzo 29, Genova)");
    if (!shopAddress || shopAddress.trim() === "") return;

    let lat = null, lon = null;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shopAddress)}`);
        const data = await res.json();
        if(data && data.length > 0) { lat = parseFloat(data[0].lat); lon = parseFloat(data[0].lon); }
    } catch(e) {}

    try {
        await setDoc(doc(db, "users", currentUser.uid), { isMerchant: true, shopName: shopName, shopAddress: shopAddress, shopLat: lat, shopLon: lon, ratingTotal: 0, ratingCount: 0 }, { merge: true });
        alert("Congratulazioni! Ora sei un Negoziante Verificato 🏪");
    } catch (error) { console.error(error); }
}

window.rateMerchant = async function(merchantId) {
    if (!currentUser) return alert("Fai il login per recensire!");
    const stars = prompt("Quante stelle dai a questo negozio? (Inserisci un numero da 1 a 5)");
    const parsedStars = parseInt(stars);
    if (isNaN(parsedStars) || parsedStars < 1 || parsedStars > 5) return alert("Valore non valido. Riprova.");
    const mRef = doc(db, "users", merchantId); const mSnap = await getDoc(mRef);
    if (mSnap.exists()) {
        const data = mSnap.data();
        await updateDoc(mRef, { ratingTotal: (data.ratingTotal || 0) + parsedStars, ratingCount: (data.ratingCount || 0) + 1 });
        alert("🌟 Recensione salvata!");
    }
}

// --- GESTIONE POST ---
window.addPost = async function() {
    if (!currentUser) return alert('Devi fare il login!');
    
    const titleInput = document.getElementById('post-title');
    const textInput = document.getElementById('post-text');
    const categoryInput = document.getElementById('post-category');
    if (!titleInput || !textInput || !categoryInput) return;

    const title = titleInput.value; const text = textInput.value; const category = categoryInput.value;
    if (title.trim() === '') return alert('Inserisci un titolo!');
    const auctionCheckbox = document.getElementById('post-is-auction');
    
    let currentAvg = "Nuovo";
    if (isCurrentUserMerchant && currentUserRatingCount > 0) { currentAvg = (currentUserRatingTotal / currentUserRatingCount).toFixed(1); }

    await addDoc(collection(db, "VfindApp_posts"), {
        title: title, text: text, category: category, score: 1, 
        upvotedBy: [currentUser.uid], downvotedBy: [], comments: [], notifiedUsers: [],
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName,
        authorPic: currentUser.photoURL, authorId: currentUser.uid, 
        isMerchant: isCurrentUserMerchant, shopAddress: isCurrentUserMerchant ? currentUserShopAddress : "",
        shopLat: isCurrentUserMerchant ? currentUserShopLat : null, shopLon: isCurrentUserMerchant ? currentUserShopLon : null,
        merchantRating: currentAvg, isAuction: auctionCheckbox ? auctionCheckbox.checked : false, reservedBy: null, reservedByName: null
    });
    
    titleInput.value = ''; textInput.value = ''; if(auctionCheckbox) auctionCheckbox.checked = false; 
}

window.deletePost = async function(postId) { if (confirm("Sei sicuro?")) { await deleteDoc(doc(db, "VfindApp_posts", postId)); } }
window.deleteComment = async function(postId, commentIndex) {
    if (confirm("Cancellare commento?")) {
        const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
        if (postSnap.exists()) { let currentComments = postSnap.data().comments || []; currentComments.splice(commentIndex, 1); await updateDoc(postRef, { comments: currentComments }); }
    }
}
window.vote = async function(postId, change) {
    if (!currentUser) return alert('Fai il login!');
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef); if (!postSnap.exists()) return;
    const postData = postSnap.data(); let newScore = postData.score; let newUpvotedBy = [...(postData.upvotedBy || [])]; let newDownvotedBy = [...(postData.downvotedBy || [])]; const userId = currentUser.uid;
    if (change === 1) {
        if (newUpvotedBy.includes(userId)) { newUpvotedBy = newUpvotedBy.filter(id => id !== userId); newScore -= 1; } 
        else { newUpvotedBy.push(userId); newScore += 1; if (newDownvotedBy.includes(userId)) { newDownvotedBy = newDownvotedBy.filter(id => id !== userId); newScore += 1; } }
    } else if (change === -1) {
        if (newDownvotedBy.includes(userId)) { newDownvotedBy = newDownvotedBy.filter(id => id !== userId); newScore += 1; } 
        else { newDownvotedBy.push(userId); newScore -= 1; if (newUpvotedBy.includes(userId)) { newUpvotedBy = newUpvotedBy.filter(id => id !== userId); newScore -= 1; } }
    }
    await updateDoc(postRef, { score: newScore, upvotedBy: newUpvotedBy, downvotedBy: newDownvotedBy });
}
window.addComment = async function(postId) {
    if (!currentUser) return alert('Fai il login!');
    const commentInput = document.getElementById(`comment-input-${postId}`); const commentText = commentInput.value; if (commentText.trim() === '') return;
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        await updateDoc(postRef, { comments: arrayUnion({ text: commentText, authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName, authorPic: currentUser.photoURL, isMerchant: isCurrentUserMerchant, authorId: currentUser.uid, shopAddress: isCurrentUserMerchant ? currentUserShopAddress : "", isOffer: false }) });
        sendNotification(postSnap.data().authorId, `💬 <b>${currentUser.displayName}</b> ha commentato il tuo post "${postSnap.data().title}".`);
    }
    commentInput.value = ''; 
}
window.makeOffer = async function(postId) {
    if (!currentUser) return alert('Devi fare il login!');
    const importo = prompt("Quanto vuoi offrire?"); if (!importo || isNaN(importo)) return alert("Inserisci un importo valido.");
    const messaggio = prompt("Messaggio? (Opzionale)", "Sarei interessato!");
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
        await updateDoc(postRef, { comments: arrayUnion({ text: `💶 <b>Ho offerto €${importo}</b><br><i>"${messaggio || ''}"</i>`, authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName, authorPic: currentUser.photoURL, isMerchant: isCurrentUserMerchant, authorId: currentUser.uid, shopAddress: isCurrentUserMerchant ? currentUserShopAddress : "", isOffer: true }) });
        sendNotification(postSnap.data().authorId, `💶 <b>${currentUser.displayName}</b> ha offerto <b>€${importo}</b> per "${postSnap.data().title}"!`);
    }
}
window.toggleNotify = async function(postId) {
    if (!currentUser) return alert('Devi fare il login!');
    const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef); if (!postSnap.exists()) return;
    const postData = postSnap.data(); let newNotifiedUsers = [...(postData.notifiedUsers || [])]; const userId = currentUser.uid;
    if (newNotifiedUsers.includes(userId)) { newNotifiedUsers = newNotifiedUsers.filter(id => id !== userId); } else { newNotifiedUsers.push(userId); alert("🔔 Avviso attivato!"); }
    await updateDoc(postRef, { notifiedUsers: newNotifiedUsers });
}
window.bookPost = async function(postId) {
    if (!currentUser) return alert('Devi fare il login!');
    if (confirm("Vuoi prenotare questo prodotto?")) {
        const postRef = doc(db, "VfindApp_posts", postId); const postSnap = await getDoc(postRef);
        await updateDoc(postRef, { reservedBy: currentUser.uid, reservedByName: currentUser.displayName });
        if (postSnap.exists()) { sendNotification(postSnap.data().authorId, `🎉 <b>VENDUTO!</b> ${currentUser.displayName} ha prenotato "${postSnap.data().title}".`); }
        alert("🎉 Prodotto prenotato!");
    }
}

// Filtri visualizzazione
window.filterCategory = function(event, category) {
    isShoppingSearchActive = false; currentFilter = category;
    document.querySelectorAll('#subVfindApp-list li').forEach(item => item.classList.remove('active'));
    if(event) event.currentTarget.classList.add('active'); renderPosts();
}

const searchInputDom = document.getElementById('search-input');
if (searchInputDom) searchInputDom.addEventListener('input', () => { isShoppingSearchActive = false; renderPosts(); });

window.renderPosts = renderPosts;

const q = query(collection(db, "VfindApp_posts"));
onSnapshot(q, (snapshot) => {
    allPosts = []; snapshot.forEach((doc) => { allPosts.push({ id: doc.id, ...doc.data() }); });
    recalcDistances(); // Ricalcola se ci sono nuovi post
    renderPosts();
});

function renderPosts() {
    const feed = document.getElementById('feed'); if (!feed) return; feed.innerHTML = '';
    const searchText = document.getElementById('search-input') ? document.getElementById('search-input').value.toLowerCase() : '';

    // IL NUOVO ORDINAMENTO
    if (currentSort === 'distance') {
        allPosts.sort((a, b) => (a.distance || 99999) - (b.distance || 99999));
    } else {
        allPosts.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    const filteredPosts = allPosts.filter(post => {
        if (isShoppingSearchActive) {
            const content = ((post.title || '') + ' ' + (post.text || '')).toLowerCase(); return myShoppingList.some(item => content.includes(item));
        } else {
            const matchCategory = currentFilter === 'Tutte' || post.category === currentFilter;
            const matchSearch = (post.title && post.title.toLowerCase().includes(searchText)) || (post.text && post.text.toLowerCase().includes(searchText));
            return matchCategory && matchSearch;
        }
    });

    if (isShoppingSearchActive && filteredPosts.length === 0) {
        feed.innerHTML = `<div style="text-align:center; padding: 40px; color: #787C7E; background: white; border-radius: 8px; border: 1px solid #ccc;"><h2>Nessun risultato 😢</h2></div>`; return;
    }

    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = post.isAuction ? 'post auction-post' : (post.isMerchant ? 'post merchant-post' : 'post');
        
        const safeComments = post.comments || [];
        const commentsHTML = safeComments.map((c, index) => {
            if (typeof c === 'string') return `<div class="comment">👤 Anonimo: ${c}</div>`; 
            const mapLink = c.shopAddress ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.shopAddress)}" target="_blank" class="shop-address">📍 ${c.shopAddress}</a>` : '';
            const badgeHTML = c.isMerchant ? `<span class="merchant-badge">🏪 Negozio</span> ${mapLink}` : '';
            let commentClass = c.isOffer ? 'comment offer-comment' : (c.isMerchant ? 'comment merchant-comment' : 'comment');
            const deleteCommentBtn = (currentUser && c.authorId === currentUser.uid) ? `<button onclick="deleteComment('${post.id}', ${index})" class="delete-btn" style="padding: 2px 5px; margin-left: auto;"><i class="fas fa-trash"></i></button>` : '';
            return `<div class="${commentClass}" style="display: flex; flex-direction: column;"><div style="display:flex; align-items:center; gap:5px; margin-bottom: 4px; width: 100%; flex-wrap: wrap;"><img src="${c.authorPic}" style="width:16px; height:16px; border-radius:50%"><b style="font-size:0.8rem">${c.authorName}</b> ${badgeHTML} ${deleteCommentBtn}</div><span>${c.text}</span></div>`;
        }).join('');

        const notifiedUsers = post.notifiedUsers || [];
        const isNotified = currentUser ? notifiedUsers.includes(currentUser.uid) : false;
        const notifyBtnClass = isNotified ? 'notify-btn active' : 'notify-btn';

        const isReserved = post.reservedBy !== null && post.reservedBy !== undefined;
        const reservedHTML = isReserved ? `<div class="reserved-badge">🔒 Riservato per ${post.reservedByName}</div>` : '';
        const bookBtnHTML = (currentUser && !isReserved && post.isMerchant && post.authorId !== currentUser.uid) ? `<button class="book-btn" onclick="bookPost('${post.id}')" title="Prenota">🤝 Prenota</button>` : '';
        const rateBtnHTML = (currentUser && post.isMerchant && post.authorId !== currentUser.uid) ? `<button class="rate-btn" onclick="rateMerchant('${post.authorId}')">⭐ Valuta</button>` : '';

        // DISTANZA (Appare sempre se hai calcolato il GPS)
        const distanceHTML = (userLat && post.distance && post.distance !== 99999) 
            ? `<div style="font-size: 0.85rem; color: #03a9f4; font-weight:bold; margin-bottom:5px;">📍 A ${post.distance.toFixed(1)} km da te</div>` : '';

        const commentInputHTML = (currentUser && !isReserved) ? `
            <div class="comment-input-area" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input type="text" id="comment-input-${post.id}" placeholder="Rispondi..." style="flex: 1; min-width: 150px;">
                <button onclick="addComment('${post.id}')">Commenta</button>
                <button class="offer-btn" onclick="makeOffer('${post.id}')">💶 Offerta</button>
                <button class="${notifyBtnClass}" onclick="toggleNotify('${post.id}')">🔔</button>
                ${bookBtnHTML} ${rateBtnHTML}
            </div>
        ` : (isReserved ? `<p style="color:#9c27b0; font-weight:bold; margin-top:10px;">Prodotto prenotato.</p>` : `<p style="font-size: 0.8rem; color: #787C7E; margin-top: 10px;">Fai il login.</p>`);

        const deleteBtnHTML = (currentUser && post.authorId === currentUser.uid) ? `<button onclick="deletePost('${post.id}')" class="delete-btn"><i class="fas fa-trash"></i></button>` : '';
        const postMapLink = post.shopAddress ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(post.shopAddress)}" target="_blank" class="shop-address">📍 ${post.shopAddress}</a>` : '';
        const starRating = post.merchantRating ? `<span style="color:#ffc107; font-weight:bold; margin-left:5px;">${post.merchantRating} ⭐</span>` : '';
        const postBadgeHTML = post.isMerchant ? `<span class="merchant-badge">🏪 Negozio</span> ${starRating} ${postMapLink}` : '';
        const auctionBadgeHTML = post.isAuction ? `<span class="auction-badge">⏳ Asta Anti-Spreco</span>` : '';

        const authorHTML = post.authorName ? `<div class="post-author" style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"><img src="${post.authorPic}" class="author-pic"><span class="author-name">${post.authorName}</span>${postBadgeHTML}</div>${deleteBtnHTML}</div>` : deleteBtnHTML;

        let upClass = "vote-btn"; let downClass = "vote-btn down";
        if (currentUser) {
            if ((post.upvotedBy || []).includes(currentUser.uid)) upClass += " voted-up"; 
            if ((post.downvotedBy || []).includes(currentUser.uid)) downClass += " voted-down"; 
        }

        postElement.innerHTML = `
            <div class="vote-column"><button class="${upClass}" onclick="vote('${post.id}', 1)"><i class="fas fa-arrow-up"></i></button><span class="score">${post.score}</span><button class="${downClass}" onclick="vote('${post.id}', -1)"><i class="fas fa-arrow-down"></i></button></div>
            <div class="post-content">
                <div class="post-header"><span class="subVfindApp-tag">v/${post.category}</span> • Postato alle ${post.timestamp || 'poco fa'} ${auctionBadgeHTML}</div>
                ${distanceHTML}
                ${authorHTML}
                ${reservedHTML}
                <h3 class="post-title" style="margin-top: 10px;">${post.title}</h3>
                <p class="post-text">${post.text}</p>
                <div class="comments-section">${commentsHTML} ${commentInputHTML}</div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}