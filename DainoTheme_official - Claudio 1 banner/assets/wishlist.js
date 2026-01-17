/**
 * DAINO WISHLIST - LocalStorage Implementation
 * Gestisce i preferiti senza necessità di login
 */

const DainoWishlist = {
    STORAGE_KEY: 'daino_wishlist',

    // Recupera la wishlist dal localStorage
    getWishlist() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Wishlist: Error reading from localStorage', e);
            return [];
        }
    },

    // Salva la wishlist nel localStorage
    saveWishlist(wishlist) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(wishlist));
            this.updateUI();
        } catch (e) {
            console.error('Wishlist: Error saving to localStorage', e);
        }
    },

    // Aggiunge un prodotto alla wishlist
    add(productId) {
        const id = String(productId);
        const wishlist = this.getWishlist();
        if (!wishlist.includes(id)) {
            wishlist.push(id);
            this.saveWishlist(wishlist);
            return true;
        }
        return false;
    },

    // Rimuove un prodotto dalla wishlist
    remove(productId) {
        const id = String(productId);
        let wishlist = this.getWishlist();
        const index = wishlist.indexOf(id);
        if (index > -1) {
            wishlist.splice(index, 1);
            this.saveWishlist(wishlist);
            return true;
        }
        return false;
    },

    // Toggle: aggiungi se non c'è, rimuovi se c'è
    toggle(productId) {
        const id = String(productId);
        if (this.isInWishlist(id)) {
            this.remove(id);
            return false; // rimosso
        } else {
            this.add(id);
            return true; // aggiunto
        }
    },

    // Verifica se un prodotto è nella wishlist
    isInWishlist(productId) {
        return this.getWishlist().includes(String(productId));
    },

    // Conta i prodotti nella wishlist
    getCount() {
        return this.getWishlist().length;
    },

    // Aggiorna tutti gli elementi UI della wishlist
    updateUI() {
        const count = this.getCount();

        // Aggiorna tutti i badge contatore
        document.querySelectorAll('[data-wishlist-count]').forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        });

        // Aggiorna stato icona header
        const headerIcon = document.getElementById('wishlistIcon');
        if (headerIcon) {
            if (count > 0) {
                headerIcon.classList.add('active');
            } else {
                headerIcon.classList.remove('active');
            }
        }

        // Aggiorna tutti i bottoni cuore sui prodotti
        document.querySelectorAll('[data-wishlist-btn]').forEach(btn => {
            const productId = btn.dataset.productId;
            if (productId && this.isInWishlist(productId)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    },

    // Inizializza la wishlist
    init() {
        // Aggiorna UI al caricamento
        this.updateUI();

        // Event delegation per bottoni wishlist
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-wishlist-btn]');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();

                // ✅ MOBILE-FIRST: Touch feedback immediato (simula hover)
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    btn.style.transform = '';
                }, 150);

                const productId = btn.dataset.productId;
                if (productId) {
                    const added = this.toggle(productId);

                    // Animazione cuore
                    btn.classList.add('wishlist-animate');
                    setTimeout(() => btn.classList.remove('wishlist-animate'), 300);
                }
            }
        });
    }
};

// Inizializza quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    DainoWishlist.init();
});

// Esporta per uso globale
window.DainoWishlist = DainoWishlist;
