// Inizializza i post cercando nel localStorage, altrimenti crea un array vuoto
let posts = JSON.parse(localStorage.getItem('vfind_posts')) || [];
let currentFilter = 'Tutte';

// Funzione per pubblicare un nuovo post
function addPost() {
    const category = document.getElementById('post-category').value;
    const text = document.getElementById('post-text').value;

    if (text.trim() === '') {
        alert('Scrivi qualcosa prima di pubblicare!');
        return;
    }

    const newPost = {
        id: Date.now(), // Genera un ID unico basato sul tempo
        category: category,
        text: text,
        comments: []
    };

    posts.unshift(newPost); // Aggiunge il post in cima alla lista
    saveAndRender();
    document.getElementById('post-text').value = ''; // Pulisce il campo di testo
}

// Funzione per aggiungere un commento a un post specifico
function addComment(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentText = commentInput.value;

    if (commentText.trim() === '') return;

    // Trova il post corretto e aggiunge il commento
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
        posts[postIndex].comments.push(commentText);
        saveAndRender();
    }
}

// Funzione per filtrare i post per categoria
function filterCategory(category) {
    currentFilter = category;
    renderPosts();
}

// Salva i dati nel browser e aggiorna lo schermo
function saveAndRender() {
    localStorage.setItem('vfind_posts', JSON.stringify(posts));
    renderPosts();
}

// Disegna i post sullo schermo
function renderPosts() {
    const feed = document.getElementById('feed');
    feed.innerHTML = ''; // Pulisce il feed

    // Filtra i post se necessario
    const filteredPosts = currentFilter === 'Tutte' 
        ? posts 
        : posts.filter(post => post.category === currentFilter);

    // Genera l'HTML per ogni post
    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        
        // Genera l'HTML per i commenti
        const commentsHTML = post.comments.map(c => `<div class="comment">${c}</div>`).join('');

        postElement.innerHTML = `
            <span class="post-category">${post.category}</span>
            <p class="post-text">${post.text}</p>
            
            <div class="comments-section">
                ${commentsHTML}
                <div class="comment-input-area">
                    <input type="text" id="comment-input-${post.id}" placeholder="Scrivi una risposta...">
                    <button onclick="addComment(${post.id})">Rispondi</button>
                </div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}

// Carica i post all'avvio della pagina
renderPosts();