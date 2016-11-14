'use strict';

class Picker {
    constructor(el) {
        // el: DOMElement
        if (!el) {
            console.error('Required argument missing');
            return null;
        }
        this.el = el;
        this.listener = null;
        this.applyEventListeners();
    }
    applyEventListeners() {
        this.el.addEventListener('dragover', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }, false);
        this.el.addEventListener('drop', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (this.listener)
                this.listener(e.dataTransfer.files);
        }, false);
    }
    subscribe(listener) {
        // Replaces the current subscriber [if any] with a new listener
        // listener: Function
        this.listener = listener
    }
}
