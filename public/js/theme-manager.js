// theme-manager.js - Dark Mode & Voice Feedback Manager

class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.voiceEnabled = localStorage.getItem('voiceEnabled') === 'true';
        this.init();
    }

    init() {
        // Apply saved theme
        this.applyTheme(this.currentTheme);

        // Create theme toggle button
        this.createThemeToggle();

        // Create voice toggle button
        this.createVoiceToggle();

        // Initialize voice synthesis
        this.initVoiceSynthesis();
    }

    createThemeToggle() {
        // Check if button already exists
        if (document.querySelector('.theme-toggle')) return;

        const button = document.createElement('button');
        button.className = 'theme-toggle';
        button.setAttribute('aria-label', 'Toggle dark mode');
        button.innerHTML = `
      <i class="fas fa-moon"></i>
      <i class="fas fa-sun"></i>
    `;

        button.addEventListener('click', () => this.toggleTheme());
        document.body.appendChild(button);
    }

    createVoiceToggle() {
        // Check if button already exists
        if (document.querySelector('.voice-toggle')) return;

        const button = document.createElement('button');
        button.className = 'voice-toggle';
        if (this.voiceEnabled) button.classList.add('active');
        button.setAttribute('aria-label', 'Toggle voice feedback');
        button.innerHTML = `<i class="fas fa-volume-up"></i>`;

        button.addEventListener('click', () => this.toggleVoice());
        document.body.appendChild(button);
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);

        // Announce theme change
        if (this.voiceEnabled) {
            const message = this.currentTheme === 'dark'
                ? 'Mode gelap diaktifkan'
                : 'Mode terang diaktifkan';
            this.speak(message);
        }
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        // Update meta theme-color for mobile browsers
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = theme === 'dark' ? '#1a1a2e' : '#ffffff';
    }

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        localStorage.setItem('voiceEnabled', this.voiceEnabled);

        const button = document.querySelector('.voice-toggle');
        if (this.voiceEnabled) {
            button.classList.add('active');
            this.speak('Suara diaktifkan');
        } else {
            button.classList.remove('active');
        }
    }

    initVoiceSynthesis() {
        // Check if browser supports speech synthesis
        if (!('speechSynthesis' in window)) {
            console.warn('Browser tidak mendukung speech synthesis');
            const voiceButton = document.querySelector('.voice-toggle');
            if (voiceButton) {
                voiceButton.style.display = 'none';
            }
            return;
        }

        // Load voices
        this.voices = [];
        this.loadVoices();

        // Some browsers load voices asynchronously
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
    }

    loadVoices() {
        this.voices = speechSynthesis.getVoices();

        // Prefer Indonesian voice if available
        this.preferredVoice = this.voices.find(voice =>
            voice.lang.startsWith('id') || voice.lang.startsWith('ID')
        ) || this.voices.find(voice =>
            voice.lang.startsWith('en')
        ) || this.voices[0];
    }

    speak(text, options = {}) {
        if (!this.voiceEnabled || !('speechSynthesis' in window)) return;

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.preferredVoice;
        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
        };

        speechSynthesis.speak(utterance);
    }

    // Public method to announce detection results
    announceDetection(result) {
        if (!this.voiceEnabled) return;

        const { dominant_class, bin, confidence, reason } = result;
        const binNames = {
            'hijau': 'hijau untuk organik',
            'kuning': 'kuning untuk anorganik',
            'biru': 'biru untuk kertas',
            'merah': 'merah untuk B3',
            'abu-abu': 'abu-abu untuk residu'
        };

        const binName = binNames[bin] || bin;
        const confidencePercent = Math.round(confidence * 100);

        let message = `Terdeteksi ${dominant_class}. `;
        message += `Masukkan ke tong sampah ${binName}. `;
        message += `Tingkat kepercayaan ${confidencePercent} persen.`;

        if (reason) {
            message += ` ${reason}`;
        }

        this.speak(message);
    }

    // Public method to announce errors
    announceError(errorMessage) {
        if (!this.voiceEnabled) return;
        this.speak(`Terjadi kesalahan: ${errorMessage}`);
    }

    // Public method to announce success
    announceSuccess(message) {
        if (!this.voiceEnabled) return;
        this.speak(message);
    }
}

// Initialize theme manager when DOM is ready
let themeManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        themeManager = new ThemeManager();
        window.themeManager = themeManager; // Make it globally accessible
    });
} else {
    themeManager = new ThemeManager();
    window.themeManager = themeManager;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
