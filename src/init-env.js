// Initialize environment variables from meta tags
document.addEventListener('DOMContentLoaded', function() {
    const openrouterMeta = document.querySelector('meta[name="openrouter-key"]');
    const hfMeta = document.querySelector('meta[name="hf-key"]');
    
    if (openrouterMeta) {
        window.OPENROUTER_API_KEY = openrouterMeta.content;
    }
    
    if (hfMeta) {
        window.HF_API_KEY = hfMeta.content;
    }
});