/**
 * Menu Overlay Management
 * Handles full-page hamburger menu overlay
 */

const MenuManager = {
    // Initialize menu UI
    init() {
        this.setupEventListeners();
    },

    // Setup event listeners
    setupEventListeners() {
        // Hamburger menu click on home.html - redirect to menu.html
        const hamburgerMenu = document.getElementById('hamburger-menu');
        if (hamburgerMenu) {
            hamburgerMenu.addEventListener('click', function() {
                window.location.href = '/menu.html';
            });
        }

        // Hamburger click - toggle menu (for menu.html page)
        const hamburger = document.querySelector('.hamburger');
        if (hamburger) {
            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
        }

        // Close menu button
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => {
                this.closeMenu();
            });
        }

        // Close menu when clicking overlay (but not the card)
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            menuOverlay.addEventListener('click', (e) => {
                // Only close if clicking directly on overlay, not on card
                if (e.target === menuOverlay) {
                    this.closeMenu();
                }
            });
        }

        // Close menu on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMenu();
            }
        });

        // Prevent body scroll when menu is open
        const menuOverlayEl = document.getElementById('menuOverlay');
        if (menuOverlayEl) {
            menuOverlayEl.addEventListener('transitionend', () => {
                if (menuOverlayEl.classList.contains('show')) {
                    document.body.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = '';
                }
            });
        }
    },

    // Open menu overlay
    openMenu() {
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            menuOverlay.classList.add('show');
            // Prevent body scroll immediately
            document.body.style.overflow = 'hidden';
        }
    },

    // Close menu overlay
    closeMenu() {
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            menuOverlay.classList.remove('show');
            // Re-enable body scroll
            document.body.style.overflow = '';
        }
    },

    // Toggle menu overlay
    toggleMenu() {
        const menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) {
            if (menuOverlay.classList.contains('show')) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MenuManager.init());
} else {
    MenuManager.init();
}

// Export for global access
window.MenuManager = MenuManager;

// Also export toggleMenu for inline onclick handlers
window.toggleMenu = () => MenuManager.toggleMenu();

