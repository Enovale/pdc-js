'use strict';

class Picker {
    constructor(el) {
        // el: DOMElement
        if (!el) {
            console.error('Required argument missing')
            return null
        }
        this.el = el
        this.listener = null
        this.dataSource = null
        this.loadedFile = false
        this.fileNameEl = document.createElement('span')
        this.fileNameEl.innerText = this.fileName = ''
        this.el.appendChild(this.fileNameEl)
        this.newButton = document.createElement('button')
        this.newButton.setAttribute('data-balloon', 'New')
        this.newButton.setAttribute('data-balloon-pos', 'down')
        this.newButton.innerHTML = '<i class="icon icon-new"></i>'
        this.el.appendChild(this.newButton)
        this.openButton = document.createElement('button')
        this.openButton.setAttribute('data-balloon', 'Open')
        this.openButton.setAttribute('data-balloon-pos', 'down')
        this.openButton.innerHTML = '<i class="icon icon-upload"></i>'
        this.el.appendChild(this.openButton)
        this.saveButton = document.createElement('button')
        this.saveButton.setAttribute('data-balloon', 'Save')
        this.saveButton.setAttribute('data-balloon-pos', 'down')
        this.saveButton.disabled = true
        this.saveButton.innerHTML = '<i class="icon icon-download"></i>'
        this.el.appendChild(this.saveButton)
        this.el.appendChild(generateHelpButton())

        this.applyEventListeners()
    }
    loadData(content, name) {
        this.loadedFile = true
        this.listener(content)
        this.fileNameEl.innerText = this.fileName = name
        this.saveButton.disabled = false
        this.el.querySelector('.help-button').classList.remove('pinging')
    }
    finishInitialization() {
        this.loadData(atob('UERDSQgAAAABADIAMgAAAA=='), 'Untitled')
    }
    applyEventListeners() {
        this.el.draggable = true
        this.el.addEventListener('dragstart', e => {
            if (!this.fileName) {
                e.preventDefault()
                return false
            }
            let c = document.createElement('canvas'),
                ctx = c.getContext('2d'),
                success = e.dataTransfer.setData('DownloadURL', this.dataSource())
            c.width = 1000
            c.height = 30
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
            ctx.font = '12pt "-apple-system", BlinkMacSystemFont, ".SFNSDisplay-Regular", Helvetica'
            ctx.textAlign = 'center'
            console.log(e.dataTransfer)
            if (success)
                ctx.fillText(this.fileName + '.pdc', 500, 20)
            else
                ctx.fillText('Drag-and-drop export not supported in this browser', 500, 20)
            let img = new Image()
            img.src = c.toDataURL()
            e.dataTransfer.setDragImage(img, 500, 20)
            e.dataTransfer.setData('DownloadURL', this.dataSource())
            console.log(e)
            e.dataTransfer.effectAllowed = 'move'
        }, false)
        this.el.addEventListener('dragenter', e => {
            this.el.classList.add('drop-target')
        })
        this.el.addEventListener('dragover', e => {
            this.el.classList.add('drop-target')
            e.stopPropagation()
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
        }, false)
        this.el.addEventListener('dragleave', e => {
            this.el.classList.remove('drop-target')
        })
        this.el.addEventListener('drop', e => {
            this.el.classList.remove('drop-target')
            e.stopPropagation()
            e.preventDefault()
            if (this.listener) {
                if (e.dataTransfer.files.length == 1) {
                    let reader = new FileReader(),
                        name = e.dataTransfer.files[0].name
                    reader.readAsBinaryString(e.dataTransfer.files[0])
                    reader.addEventListener('load',
                        () => this.loadData(reader.result, name))
                }
            }
        }, false)
        this.el.addEventListener('click', e => {
            if (this.loadedFile) {
                let newName = prompt('Rename file "' + this.fileName + '"')
                if (newName)
                    this.fileNameEl.innerText = this.fileName = newName
            }
        }, false)
        this.saveButton.addEventListener('click', e => {
            e.stopPropagation()
            let data = 'data:application/octet-stream;base64,' + btoa(this.dataSource()),
                fakeLink = document.createElement('a')
            fakeLink.href = data
            fakeLink.setAttribute('download', this.fileName + '.pdc')
            let event = new MouseEvent('click')
            fakeLink.dispatchEvent(event)
        }, false)
        this.openButton.addEventListener('click', e => {
            e.stopPropagation()
            let fakeInput = document.createElement('input')
            document.body.appendChild(fakeInput)
            fakeInput.setAttribute('type', 'file')
            fakeInput.click()
            fakeInput.addEventListener('change', e => {
                if (fakeInput.files.length == 1) {
                    let reader = new FileReader();
                    let file = fakeInput.files[0];
                    let dotLastIndex = file.name.lastIndexOf('.');
                    let name = file.name.substring(0, dotLastIndex);
                    reader.readAsBinaryString(file)
                    reader.addEventListener('load',
                        () => this.loadData(reader.result, name))
                }
            })
        }, false)
        this.newButton.addEventListener('click', e => {
            e.stopPropagation()
            console.log(typeof this.fileName)
            if (this.loadedFile) {
                if (confirm('Discard current file?')) {
                    this.loadData(atob('UERDSQgAAAABADIAMgAAAA=='), 'Untitled')
                }
            } else {
                this.loadData(atob('UERDSQgAAAABADIAMgAAAA=='), 'Untitled')
            }
        }, false)
    }
    setDataSource(dataSource) {
        // Replaces the current data source [if any] with a new data source
        // dataSource: Function
        this.dataSource = dataSource
    }
    subscribe(listener) {
        // Replaces the current subscriber [if any] with a new listener
        // listener: Function
        this.listener = listener
    }
}
