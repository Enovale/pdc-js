'use strict';

function detectCompatibility() {
    return true
}

window.addEventListener('load', function() {
    if (!detectCompatibility() || true) {
        showIntro()
    }
    window.picker = new Picker(document.querySelector('#picker'))
    window.editor = new Editor({
        'el': document.querySelector('#editor'),
        'picker': window.picker
    })
})
