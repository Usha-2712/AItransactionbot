/**
 * Profile UI Management
 * Handles dropdown, panel, and localStorage for user profile
 */

const ProfileManager = {
    // Initialize profile UI
    init() {
        this.loadProfileFromStorage();
        this.setupEventListeners();
        this.updateProfileDisplay();
    },

    // Setup event listeners
    setupEventListeners() {
        // Profile avatar click - toggle dropdown
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            profileAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profile-avatar') && !e.target.closest('.profile-dropdown')) {
                this.closeDropdown();
            }
        });

        // Profile menu item click
        const profileMenuItem = document.getElementById('profileMenuItem');
        if (profileMenuItem) {
            profileMenuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeDropdown();
                this.showProfilePanel();
            });
        }

        // Logout menu item click
        const logoutMenuItem = document.getElementById('logoutMenuItem');
        if (logoutMenuItem) {
            logoutMenuItem.style.cursor = 'pointer';
            logoutMenuItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeDropdown();
                // Use setTimeout to ensure dropdown closes before redirect
                setTimeout(() => {
                    this.handleLogout();
                }, 100);
            });
        }

        // Close profile panel button
        const closeProfileBtn = document.getElementById('closeProfileBtn');
        if (closeProfileBtn) {
            closeProfileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideProfilePanel();
            });
        }

        // Close profile panel when clicking outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('profilePanel');
            const avatar = document.querySelector('.profile-avatar');
            
            if (panel && panel.classList.contains('show')) {
                // Check if click is outside the panel and outside the avatar
                if (!panel.contains(e.target) && !avatar.contains(e.target)) {
                    this.hideProfilePanel();
                }
            }
        });

        // Save profile button
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', () => {
                this.saveProfile();
            });
        }

        // Profile image upload
        const profileImageInput = document.getElementById('profileImageInput');
        if (profileImageInput) {
            profileImageInput.addEventListener('change', (e) => {
                this.handleImageUpload(e);
            });
        }
    },

    // Toggle dropdown menu
    toggleDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    },

    // Close dropdown menu
    closeDropdown() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    },

    // Show profile panel
    showProfilePanel() {
        const panel = document.getElementById('profilePanel');
        if (panel) {
            panel.classList.add('show');
            this.loadProfileToForm();
        }
    },

    // Hide profile panel
    hideProfilePanel() {
        const panel = document.getElementById('profilePanel');
        if (panel) {
            panel.classList.remove('show');
        }
    },

    // Load profile data from localStorage
    loadProfileFromStorage() {
        try {
            const profileData = localStorage.getItem('userProfile');
            if (profileData) {
                this.profile = JSON.parse(profileData);
            } else {
                // Initialize with empty profile
                this.profile = {
                    firstName: '',
                    lastName: '',
                    email: '',
                    address: '',
                    contactNumber: '',
                    profileImage: ''
                };
            }
        } catch (error) {
            console.error('Error loading profile from storage:', error);
            this.profile = {
                firstName: '',
                lastName: '',
                email: '',
                address: '',
                contactNumber: '',
                profileImage: ''
            };
        }
    },

    // Save profile data to localStorage
    saveProfileToStorage() {
        try {
            localStorage.setItem('userProfile', JSON.stringify(this.profile));
            return true;
        } catch (error) {
            console.error('Error saving profile to storage:', error);
            return false;
        }
    },

    // Load profile data into form
    loadProfileToForm() {
        document.getElementById('profileFirstName').value = this.profile.firstName || '';
        document.getElementById('profileLastName').value = this.profile.lastName || '';
        document.getElementById('profileEmail').value = this.profile.email || '';
        document.getElementById('profileAddress').value = this.profile.address || '';
        document.getElementById('profileContact').value = this.profile.contactNumber || '';
        
        // Update profile image preview if exists
        const imagePreview = document.getElementById('profileImagePreview');
        const imagePlaceholder = document.getElementById('profileImagePlaceholder');
        
        if (this.profile.profileImage) {
            if (imagePreview) {
                imagePreview.src = this.profile.profileImage;
                imagePreview.style.display = 'block';
            }
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'none';
            }
        } else {
            if (imagePreview) {
                imagePreview.style.display = 'none';
            }
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'flex';
                // Update placeholder with initials
                const initials = (this.profile.firstName?.charAt(0) || '') + (this.profile.lastName?.charAt(0) || '');
                imagePlaceholder.textContent = initials.toUpperCase() || 'U';
            }
        }
    },

    // Save profile from form
    saveProfile() {
        // Get form values
        this.profile.firstName = document.getElementById('profileFirstName').value.trim();
        this.profile.lastName = document.getElementById('profileLastName').value.trim();
        this.profile.email = document.getElementById('profileEmail').value.trim();
        this.profile.address = document.getElementById('profileAddress').value.trim();
        this.profile.contactNumber = document.getElementById('profileContact').value.trim();

        // Validate required fields
        if (!this.profile.firstName || !this.profile.lastName || !this.profile.email) {
            alert('Please fill in First Name, Last Name, and Email');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.profile.email)) {
            alert('Please enter a valid email address');
            return;
        }

        // Save to localStorage
        if (this.saveProfileToStorage()) {
            this.updateProfileDisplay();
            this.hideProfilePanel();
            
            // Show success message
            this.showNotification('Profile saved successfully!');
        } else {
            alert('Failed to save profile. Please try again.');
        }
    },

    // Handle image upload
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
            this.profile.profileImage = e.target.result;
            
            // Update preview
            const imagePreview = document.getElementById('profileImagePreview');
            const imagePlaceholder = document.getElementById('profileImagePlaceholder');
            if (imagePreview) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'none';
            }

            // Save to localStorage
            this.saveProfileToStorage();
            this.updateProfileDisplay();
        };
        reader.readAsDataURL(file);
    },

    // Update profile display (avatar initials, etc.)
    updateProfileDisplay() {
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar) {
            // Update avatar with initials
            const firstName = this.profile.firstName || '';
            const lastName = this.profile.lastName || '';
            const initials = (firstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase() || 'U';

            // Update avatar background image if profile image exists
            if (this.profile.profileImage) {
                profileAvatar.style.backgroundImage = `url(${this.profile.profileImage})`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';
            } else {
                profileAvatar.style.backgroundImage = '';
                profileAvatar.textContent = initials;
            }
        }
    },

    // Handle logout
    handleLogout() {
        try {
            // Clear user data from localStorage
            localStorage.removeItem('userProfile');
            
            // Clear session data from sessionStorage
            sessionStorage.removeItem('googleUser');
            sessionStorage.removeItem('googleAccessToken');
            sessionStorage.removeItem('oauthUserData');
            sessionStorage.removeItem('userSession');
            
            // Redirect to login page
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout error:', error);
            // Still redirect even if clearing storage fails
            window.location.href = '/login.html';
        }
    },

    // Show notification
    showNotification(message) {
        // Create or update notification element
        let notification = document.getElementById('profileNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'profileNotification';
            notification.className = 'profile-notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.classList.add('show');

        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ProfileManager.init());
} else {
    ProfileManager.init();
}

// Export for global access
window.ProfileManager = ProfileManager;

