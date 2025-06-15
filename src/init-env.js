// Initialize environment variables from meta tags
document.addEventListener('DOMContentLoaded', function() {
    const openrouterMeta = document.querySelector('meta[name="openrouter-key"]');
    const hfMeta = document.querySelector('meta[name="hf-key"]');
    
    if (openrouterMeta && openrouterMeta.content) {
        window.OPENROUTER_API_KEY = openrouterMeta.content;
        console.log('OpenRouter API key loaded');
    } else {
        console.log('No OpenRouter API key found in meta tags');
    }
    
    if (hfMeta && hfMeta.content) {
        window.HF_API_KEY = hfMeta.content;
        console.log('HF API key loaded');
    }
});