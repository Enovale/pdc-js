'use strict';

window.addEventListener('load', function() {
    window.picker = new Picker(document.querySelector('#picker'))
    window.editor = new Editor({
        'el': document.querySelector('#editor'),
        'picker': window.picker
    })
})
