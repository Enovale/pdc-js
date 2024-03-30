'use strict';

class Editor {
    constructor(args) {
        this.selectedCommand = null
        this.movingPoint = null
        this.canvasScaleSaved = 8
        this.canvasScale = 8
        this.pixelRatio = window.devicePixelRatio || 1
        this.shiftPressed = false
        this.altPressed = false
        let { el, picker } = args
        if (![el, picker].reduce((a, b) => a && b)) {
            console.error('Required argument missing')
            return null
        }
        [this.el, this.picker] = [el, picker]
        el.innerHTML = ''
        el.classList.add('empty')
        this.picker.subscribe((a) => this.updateEditorFromData(a))
        this.picker.setDataSource(a => this.image.getBinaryRepresentation())

        this.handleBodyGestures()

        window.addEventListener('keydown', e => {
            this.altPressed = e.altKey || e.metaKey;
            this.shiftPressed = e.shiftKey || e.ctrlKey;

            switch (e.key) {
                case "ArrowLeft":
                    this.moveCommand(-1, 0);
                    break;
                case "ArrowUp":
                    this.moveCommand(0, -1);
                    break;
                case "ArrowRight":
                    this.moveCommand(1, 0);
                    break;
                case "ArrowDown":
                    this.moveCommand(0, 1);
                    break;
            }

            this.redrawCanvas();
        })
        window.addEventListener('keyup', e => {
            this.altPressed = e.altKey || e.metaKey;
            this.shiftPressed = e.shiftKey || e.ctrlKey;
            this.redrawCanvas();
        })
        window.addEventListener('keypress', e => {
            if (e.charCode == 122 && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                // Cmd-Z or Ctrl-Z
                this.undo()
                e.preventDefault()
            } else if ((e.charCode == 122 && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
                       (e.charCode == 121 && e.ctrlKey)) {
                // Cmd-Shift-Z or Ctrl-Shift-Z or Ctrl-Y
                this.redo()
                e.preventDefault()
            } else if ((e.charCode == 45 || e.charCode == 61) && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
            }
        }, false)

        this.picker.finishInitialization()
    }
    icon(name, large) {
        return '<i class="' + (large ? 'icon-lg' : 'icon') + ' icon-' + name + '"></i>'
    }
    iconEl(name, large) {
        let el = document.createElement('i')
        el.classList.add((large ? 'icon-lg' : 'icon'), 'icon-' + name)
        return el
    }
    updateEditorFromData(data) {
        // Loads a binary string and replaces the editor's content with it.
        // data: String
        console.log(data)
        let pdcParser = new PDCParser()
        this.updateEditor(pdcParser.parse(data))
    }
    updateEditor(image) {
        this.el.classList.remove('empty')
        this.image = image
        this.history = [this.image.clone()]
        this.future = []
        this.imageChangeReason = null
        this.canvasScale = 8
        this.selectedCommand = null
        this.movingPoint = null
        this.rebuildChrome()
    }
    pushHistoryState() {
        this.history.push(this.image.clone())
        this.future = []
        this.el.querySelector('.undo-button').disabled = false
        this.el.querySelector('.redo-button').disabled = true
    }
    replaceHistoryStateIfReasonOrPush(reason) {
        if (this.imageChangeReason == reason) {
            this.history[this.history.length - 1] = this.image.clone()
        } else {
            if (reason)
                this.imageChangeReason = reason
            else
                this.imageChangeReason = null
            this.pushHistoryState()
        }
    }
    undo() {
        if (this.history.length > 1) {
            this.imageChangeReason = null
            while (this.history[this.history.length - 1].equals(this.image)) {
                this.history.pop()
            }
            this.future.unshift(this.image)
            this.image = this.history[this.history.length - 1].clone()

            this.redrawCanvas()
            this.rebuildList()
        }
    }
    redo() {
        if (this.future.length >= 1) {
            this.imageChangeReason = null
            this.image = this.future.shift()
            this.history.push(this.image.clone())

            this.redrawCanvas()
            this.rebuildList()
        }
    }
    moveCommand(x, y) {
        let command = this.image.commands[this.selectedCommand];

        if (command == null) {
            console.log("Make sure to select a command");
            return;
        }

        for (let i = 0; i < command.points.length; i++) {
            command.points[i][0] += x;
            command.points[i][1] += y;
        }
    }
    rebuildChrome() {
        this.el.innerHTML = ''

        if (this.image) {
            this.canvas = document.createElement('canvas')
            this.canvas.classList.add('main-view')
            this.canvas.addEventListener('mousemove', ev => this.redrawCanvas(ev))
            this.canvas.addEventListener('mousedown', ev => this.mouseDownHandler(ev))
            this.canvas.addEventListener('mouseup', ev => this.mouseUpHandler(ev))

            let canvasWrapperEl = document.createElement('div')
            canvasWrapperEl.classList.add('main-view-wrapper')
            canvasWrapperEl.appendChild(this.canvas)
            this.el.appendChild(canvasWrapperEl)

            this.handleCanvasGestures(canvasWrapperEl)

            let sidebarEl = document.createElement('div')
            sidebarEl.classList.add('sidebar')
            this.el.appendChild(sidebarEl)

            let listControlEl = document.createElement('div')
            listControlEl.classList.add('list-control-row')
            sidebarEl.appendChild(listControlEl)

            let listEl = document.createElement('ol')
            listEl.classList.add('command-list')
            sidebarEl.appendChild(listEl)

            let controlsEl = document.createElement('div')
            controlsEl.classList.add('controls')
            sidebarEl.appendChild(controlsEl)

            this.rebuildList()
            this.rebuildControls()
            this.redrawCanvas()
            setTimeout(() => this.redrawCanvas(), 100)
        } else {

        }
    }
    updateCanvasScaleWithFactor(scale) {
        this.canvasScale = Math.round(this.canvasScaleSaved * scale * 100) / 100
        if (this.canvasScale > 48)
            this.canvasScale = 48
        if (this.canvasScale < 1)
            this.canvasScale = 1
        this.updateControls()
    }
    handleBodyGestures(canvasWrapper) {
        document.body.addEventListener('gesturestart',
            a => { a.preventDefault(); a.stopPropagation() })
        document.body.addEventListener('gesturechange',
            a => { a.preventDefault(); a.stopPropagation() })
        document.body.addEventListener('gestureend',
            a => { a.preventDefault(); a.stopPropagation() })
        document.body.addEventListener('mousewheel',
            a => { if (a.ctrlKey) { a.preventDefault(); a.stopPropagation() }})
    }
    handleCanvasGestures(canvasWrapper) {
        canvasWrapper.addEventListener('gesturestart',
            a => {
                this.canvasScaleSaved = this.canvasScale
                this.updateCanvasScaleWithFactor(a.scale)
                this.redrawCanvas(); a.preventDefault(); a.stopPropagation()
            })
        let lastUpdate = new Date()
        canvasWrapper.addEventListener('gesturechange',
            a => {
                // don't update at more than 60hz
                if (new Date() - lastUpdate < 16) return
                lastUpdate = new Date()
                this.updateCanvasScaleWithFactor(a.scale)
                this.redrawCanvas(); a.preventDefault(); a.stopPropagation()
            })
        canvasWrapper.addEventListener('gestureend',
            a => {
                this.updateCanvasScaleWithFactor(a.scale)
                this.redrawCanvas(); a.preventDefault(); a.stopPropagation()
            })
        canvasWrapper.addEventListener('mousewheel',
            a => {
                if (a.ctrlKey) {
                    this.canvasScaleSaved = this.canvasScale
                    this.updateCanvasScaleWithFactor((100 - a.deltaY) / 100)
                    this.redrawCanvas(); a.preventDefault(); a.stopPropagation()
                }
            })
    }
    rebuildList() {
        let listControlRow = this.el.querySelector('.list-control-row')
        listControlRow.innerHTML = ''

        let addPathButton = document.createElement('button')
        addPathButton.setAttribute('data-balloon', 'New Path')
        addPathButton.setAttribute('data-balloon-pos', 'down')
        addPathButton.appendChild(this.iconEl('path', false))
        listControlRow.appendChild(addPathButton)
        addPathButton.addEventListener('click', e => {
            let c = new PDCPathCommand()
            c.strokeColor = 192; c.strokeWidth = 3; c.fillColor = 0; c.pathOpen = true
            c.points = [[5, 5], [10, 10]]; this.image.commands.push(c)
            this.selectCommand(c)
            this.pushHistoryState(); this.rebuildList(); this.redrawCanvas()
        })

        let addPrecisePathButton = document.createElement('button')
        addPrecisePathButton.setAttribute('data-balloon', 'New Precise Path')
        addPrecisePathButton.setAttribute('data-balloon-pos', 'down')
        addPrecisePathButton.appendChild(this.iconEl('precise-path', false))
        listControlRow.appendChild(addPrecisePathButton)
        addPrecisePathButton.addEventListener('click', e => {
            let c = new PDCPrPathCommand()
            c.strokeColor = 192; c.strokeWidth = 3; c.fillColor = 0; c.pathOpen = true
            c.points = [[5, 5], [10, 10]]; this.image.commands.push(c)
            this.selectCommand(c)
            this.pushHistoryState(); this.rebuildList(); this.redrawCanvas()
        })

        let addCircleButton = document.createElement('button')
        addCircleButton.setAttribute('data-balloon', 'New Circle')
        addCircleButton.setAttribute('data-balloon-pos', 'down')
        addCircleButton.appendChild(this.iconEl('circle', false))
        listControlRow.appendChild(addCircleButton)
        addCircleButton.addEventListener('click', e => {
            let c = new PDCCircleCommand()
            c.strokeColor = 192
            c.strokeWidth = 3; c.fillColor = 255; c.radius = 5
            c.points = [[10, 10]]; this.image.commands.push(c)
            this.pushHistoryState(); this.rebuildList(); this.redrawCanvas()
            this.selectCommand(c)
        })

        let undoButton = document.createElement('button')
        undoButton.setAttribute('data-balloon', 'Undo ⌘Z')
        undoButton.setAttribute('data-balloon-pos', 'down')
        undoButton.setAttribute('data-balloon-length', 'tiny')
        undoButton.classList.add('undo-button')
        undoButton.appendChild(this.iconEl('undo', false))
        if (this.history.length <= 1)
            undoButton.disabled = true
        listControlRow.appendChild(undoButton)
        undoButton.addEventListener('click', e => {
            this.undo()
        })

        let redoButton = document.createElement('button')
        redoButton.setAttribute('data-balloon', 'Redo ⌘⇧Z')
        redoButton.setAttribute('data-balloon-pos', 'down')
        redoButton.setAttribute('data-balloon-length', 'tiny')
        redoButton.classList.add('redo-button')
        redoButton.appendChild(this.iconEl('redo', false))
        if (this.future.length == 0)
            redoButton.disabled = true
        listControlRow.appendChild(redoButton)
        redoButton.addEventListener('click', e => {
            this.redo()
        })

        this.draggingCommand = null
        let listEl = this.el.querySelector('ol.command-list')
        listEl.innerHTML = ''
        let commands = this.image.commands
        for (let _i in commands) {
            let i = parseInt(_i)
            let command = commands[i]
            let type = command.getFriendlyName()
            let itemEl = document.createElement('li')
            itemEl.setAttribute('data-index', i)
            let itemHeader = document.createElement('div')
            itemEl.appendChild(itemHeader)
            let itemSettings = document.createElement('div')
            itemEl.appendChild(itemSettings)

            itemHeader.appendChild(this.iconEl(command.getFriendlyName(), true))
            itemHeader.classList.add('item-header')

            itemSettings.classList.add('item-settings')

            let hiddenToggle = document.createElement('button')
            hiddenToggle.setAttribute('data-balloon', 'Toggle Visibility')
            hiddenToggle.setAttribute('data-balloon-pos', 'down')
            itemHeader.appendChild(hiddenToggle)
            hiddenToggle.innerHTML = (command.flags.hidden ? this.icon('hidden') : this.icon('visible'))
            hiddenToggle.addEventListener('click', (ev) => {
                command.flags.hidden = !command.flags.hidden
                if (this.selectedCommand == i)
                    this.selectCommand(null)
                hiddenToggle.innerHTML = (command.flags.hidden ? this.icon('hidden') : this.icon('visible'))
                this.pushHistoryState()
                ev.stopPropagation()
                this.redrawCanvas()
            })

            let deleteButton = document.createElement('button')
            deleteButton.setAttribute('data-balloon', 'Delete')
            deleteButton.setAttribute('data-balloon-pos', 'down')
            itemHeader.appendChild(deleteButton)
            deleteButton.innerHTML = this.icon('delete')
            deleteButton.addEventListener('click', (ev) => {
                this.image.commands.splice(i, 1)
                if (this.selectedCommand == i)
                    this.selectCommand(null)
                this.pushHistoryState()
                ev.stopPropagation()
                this.rebuildList()
                this.redrawCanvas()
            })

            let itemCanvas = document.createElement('canvas')
            itemHeader.appendChild(itemCanvas)
            this.redrawCommandCanvas(command, itemCanvas)

            if (type == 'precise-path' || type == 'path') {
                let buttonRow = document.createElement('div')
                buttonRow.classList.add('path-controls', 'button-row')

                let typeToggle = document.createElement('button')
                buttonRow.appendChild(typeToggle)
                typeToggle.innerHTML = this.icon(
                    type == 'precise-path' ? 'make-path' : 'make-precise')
                typeToggle.setAttribute('data-balloon', type == 'precise-path'
                    ? 'Convert to Path' : 'Convert to Precise Path')
                typeToggle.setAttribute('data-balloon-pos', 'down')
                typeToggle.addEventListener('click', (ev) => {
                    if (type == 'precise-path')
                        commands[i] = command.toPath()
                    else if (type == 'path')
                        commands[i] = command.toPrecise()
                    this.pushHistoryState()
                    ev.stopPropagation()
                    this.rebuildList()
                    this.redrawCanvas()
                })
                let openToggle = document.createElement('button')
                openToggle.setAttribute('data-balloon-pos', 'down')
                buttonRow.appendChild(openToggle)
                if (command.pathOpen)
                    openToggle.setAttribute('data-balloon', 'Open'),
                        openToggle.innerHTML = this.icon('path-open')
                else
                    openToggle.setAttribute('data-balloon', 'Closed'),
                        openToggle.innerHTML = this.icon('path-closed')
                openToggle.addEventListener('click', (ev) => {
                    command.pathOpen ^= 1
                    if (command.pathOpen)
                        openToggle.setAttribute('data-balloon', 'Open'),
                            openToggle.innerHTML = this.icon('path-open')
                    else
                        openToggle.setAttribute('data-balloon', 'Closed'),
                            openToggle.innerHTML = this.icon('path-closed')
                    this.pushHistoryState()
                    ev.stopPropagation()
                    this.redrawCanvas()
                })
                itemSettings.appendChild(buttonRow)
            } else if (type == 'circle') {
                let radiusControlEl = document.createElement('div')
                radiusControlEl.classList.add('radius-control', 'slider-row')

                let radiusIcon = this.iconEl('radius')
                radiusControlEl.appendChild(radiusIcon)
                radiusIcon.setAttribute('data-balloon', 'Radius')
                radiusIcon.setAttribute('data-balloon-pos', 'right')

                let radiusEl = document.createElement('input')
                let radiusSliderEl = document.createElement('input')

                radiusSliderEl.type = 'range'
                radiusSliderEl.min = 1, radiusSliderEl.max = 50, radiusSliderEl.step = 1
                radiusSliderEl.value = commands[i].radius
                radiusSliderEl.addEventListener('input', (e) => {
                    commands[i].radius = parseInt(radiusSliderEl.value)
                    radiusEl.value = radiusSliderEl.value
                    this.replaceHistoryStateIfReasonOrPush('radius' + this.selectedCommand)
                    this.redrawCanvas()
                    this.redrawCommandCanvas(command, itemCanvas)
                })
                radiusEl.type = 'number'
                radiusEl.min = 1, radiusEl.max = 250, radiusEl.step = 1
                radiusEl.value = commands[i].radius
                radiusEl.addEventListener('input', (e) => {
                    commands[i].radius = parseInt(radiusEl.value)
                    radiusSliderEl.value = radiusEl.value
                    this.replaceHistoryStateIfReasonOrPush('radius' + this.selectedCommand)
                    this.redrawCanvas()
                    this.redrawCommandCanvas(command, itemCanvas)
                })
                radiusControlEl.appendChild(radiusSliderEl)
                radiusControlEl.appendChild(radiusEl)
                itemSettings.appendChild(radiusControlEl)
            }

            let strokeWidthControlEl = document.createElement('div')
            strokeWidthControlEl.classList.add('stroke-width-control', 'slider-row')
            let strokeWidthIcon = this.iconEl('stroke-width')
            strokeWidthControlEl.appendChild(strokeWidthIcon)
            strokeWidthIcon.setAttribute('data-balloon', 'Stroke')
            strokeWidthIcon.setAttribute('data-balloon-pos', 'right')

            let strokeWidthEl = document.createElement('input')
            let strokeWidthSliderEl = document.createElement('input')

            strokeWidthSliderEl.type = 'range'
            strokeWidthSliderEl.min = 1, strokeWidthSliderEl.max = 20, strokeWidthSliderEl.step = 1
            strokeWidthSliderEl.value = commands[i].strokeWidth
            strokeWidthSliderEl.addEventListener('input', (e) => {
                commands[i].strokeWidth = strokeWidthSliderEl.value
                strokeWidthEl.value = strokeWidthSliderEl.value
                this.replaceHistoryStateIfReasonOrPush('strokeWidth' + this.selectedCommand)
                this.redrawCanvas()
                this.redrawCommandCanvas(command, itemCanvas)
            })
            strokeWidthEl.type = 'number'
            strokeWidthEl.min = 1, strokeWidthEl.max = 250, strokeWidthEl.step = 1
            strokeWidthEl.value = commands[i].strokeWidth
            strokeWidthEl.addEventListener('input', (e) => {
                commands[i].strokeWidth = strokeWidthEl.value
                strokeWidthSliderEl.value = strokeWidthEl.value
                this.replaceHistoryStateIfReasonOrPush('strokeWidth' + this.selectedCommand)
                this.redrawCanvas()
                this.redrawCommandCanvas(command, itemCanvas)
            })
            strokeWidthControlEl.appendChild(strokeWidthSliderEl)
            strokeWidthControlEl.appendChild(strokeWidthEl)
            itemSettings.appendChild(strokeWidthControlEl)

            let colorRow = document.createElement('div')
            colorRow.classList.add('radius-control', 'color-row')

            const channelShifts = {'a': 6, 'r': 4, 'g': 2, 'b': 0}
            let channelSliders = {'stroke': {}, 'fill': {}},
                alphaBoxes = {'stroke': {}, 'fill': {}}
            for (let colorRegion of ['stroke', 'fill']) {
                let thisColorRow = document.createElement('div'),
                    thisColorIcon = this.iconEl(colorRegion + '-color'),
                    thisRegion = colorRegion
                thisColorRow.appendChild(thisColorIcon)
                thisColorIcon.setAttribute('data-balloon',
                    thisRegion.substring(0, 1).toUpperCase() + thisRegion.substring(1))
                thisColorIcon.setAttribute('data-balloon-pos', 'right')
                let thisAlphaBox = document.createElement('input')
                thisAlphaBox.type = 'checkbox'
                thisColorRow.appendChild(thisAlphaBox)
                alphaBoxes[thisRegion] = thisAlphaBox
                let updateColor = () => {
                        let sliders = channelSliders[thisRegion],
                            color = 0
                        for (let k of Object.keys(sliders))
                            color |= (parseInt(sliders[k].value) << parseInt(k))
                        for (let k of Object.keys(sliders))
                            sliders[k].style.background = 'linear-gradient(to right, ' +
                                getRGBA(color & ~(0b11 << parseInt(k)) | 0b11 << 6) + ', ' +
                                getRGBA(color | (0b11 << parseInt(k)) | 0b11 << 6) + ')'
                        color |= alphaBoxes[thisRegion].checked ? 0b11000000 : 0
                        if (thisRegion == 'stroke') {
                            command.strokeColor = color
                        } else {
                            command.fillColor = color
                        }
                    },
                    changeColor = () => {
                        updateColor()
                        this.redrawCanvas()
                        this.redrawCommandCanvas(command, itemCanvas)
                        this.replaceHistoryStateIfReasonOrPush(thisRegion + 'Color' + i)
                    }
                thisAlphaBox.addEventListener('change', changeColor)
                thisAlphaBox.checked = command
                if (colorRegion == 'stroke')
                    thisAlphaBox.checked = (command.strokeColor >> channelShifts.a)
                                           & 0b11 ? true : false
                else
                    thisAlphaBox.checked = (command.fillColor >> channelShifts.a)
                                           & 0b11 ? true : false
                for (let channel of ['r', 'g', 'b']) {
                    let channelSlider = document.createElement('input'),
                        channelShift = channelShifts[channel]
                    channelSliders[colorRegion][channelShift] = channelSlider
                    channelSlider.type = 'range'; channelSlider.min = 0
                    channelSlider.max = 3; channelSlider.step = 1
                    thisColorRow.appendChild(channelSlider)
                    if (colorRegion == 'stroke')
                        channelSlider.value = (command.strokeColor >> channelShift) & 0b11
                    else
                        channelSlider.value = (command.fillColor >> channelShift) & 0b11
                    channelSlider.addEventListener('input', changeColor)
                }
                colorRow.appendChild(thisColorRow)
                updateColor()
            }
            itemSettings.appendChild(colorRow)

            itemSettings.addEventListener('click', e => e.stopPropagation())

            itemEl.draggable = true
            itemEl.addEventListener('dragstart', (e) => {
                let el = document.activeElement
                if (el) {
                    while (el.classList && !el.classList.contains('item-settings') &&
                           el.tagName != 'LI') {
                        el = el.parentNode
                    }
                    if (el.classList && el.classList.contains('item-settings')) {
                        event.preventDefault()
                        return false
                    }
                }
                this.draggingCommand = i
                itemEl.classList.add('dragging')
                e.dataTransfer.setData('text/plain', i)
                e.dataTransfer.setDragImage(itemCanvas,
                    Math.round(itemCanvas.offsetWidth / 2),
                    Math.round(itemCanvas.offsetHeight / 2))
            })
            itemEl.addEventListener('dragend', (e) => {
                this.draggingCommand = null
                itemEl.classList.remove('dragging')
                if (itemEl.parentNode)
                    for (let el of itemEl.parentNode.childNodes)
                        el.classList.remove('shift-up', 'shift-down', 'drop-target')
            })
            itemEl.addEventListener('dragover', (e) => {
                e.dataTransfer.dropEffect = 'move'
                e.preventDefault()
            })
            itemEl.addEventListener('dragenter', (e) => {
                // dragged item enters new -> update top/bottom shifts
                if (this.draggingCommand != null) {
                    let origin = parseInt(this.draggingCommand) //HACK
                    for (let el of itemEl.parentNode.childNodes)
                        el.classList.remove('shift-up', 'shift-down', 'drop-target')
                    if (i > origin)
                        for (let iter = i, el = itemEl; iter > origin;
                                iter -= 1, el = el.previousSibling)
                            el.classList.add('shift-up')
                    else if (i < origin)
                        for (let iter = i, el = itemEl; iter < origin;
                                iter += 1, el = el.nextSibling)
                            el.classList.add('shift-down')
                }
                itemEl.classList.add('drop-target')
            })
            itemEl.addEventListener('dragleave', (e) => {
                let t = e.relatedTarget
                if (t === null)
                    return
                do {
                    if (t == itemEl)
                        return
                    t = t.parentNode
                } while (t != listEl && t != document.body)
                itemEl.classList.remove('drop-target')
            })
            itemEl.addEventListener('drop', (e) => {
                itemEl.classList.remove('drop-target')
                e.preventDefault()
                e.stopPropagation()

                let result = e.dataTransfer.getData('text/plain')
                if (result === '')
                    console.log('empty drop')
                else {
                    result = parseInt(result)
                    if (result == i)
                        return
                    let origin = result,
                        [c] = this.image.commands.splice(origin, 1),
                        oldSelected = this.selectedCommand
                    this.image.commands.splice(i, 0, c)
                    if (oldSelected == origin)
                        this.selectedCommand = i
                    else if ((oldSelected == i && origin < i) ||
                             (oldSelected > origin && oldSelected < i))
                        this.selectedCommand -= 1
                    else if ((oldSelected == i && origin > i) ||
                             (oldSelected < origin && oldSelected > i))
                        this.selectedCommand += 1
                    this.pushHistoryState()
                    this.rebuildList()
                    this.redrawCanvas()
                }
            })

            if (this.selectedCommand == i) {
                itemEl.classList.add('selected')
                itemEl.addEventListener('click', () => {
                    this.selectCommand(null)
                })
            } else {
                itemEl.addEventListener('click', () => {
                    if (!command.flags.hidden)
                        this.selectCommand(command)
                })
            }
            listEl.appendChild(itemEl)
        }
    }
    rebuildControls() {
        let controlsEl = this.el.querySelector('.controls')
        controlsEl.innerHTML = ''

        let widthEl = document.createElement('input')
        widthEl.classList.add('width')
        widthEl.type = 'number'
        widthEl.min = 1; widthEl.max = 255; widthEl.value = this.image.width
        widthEl.addEventListener('input', (e) => {
            this.image.width = parseInt(widthEl.value)
            if (this.image.width > 1024)
                widthEl.value = this.image.width = 1024
            this.redrawCanvas()
            this.rebuildList()
        })

        let heightEl = document.createElement('input')
        heightEl.classList.add('height')
        heightEl.type = 'number'
        heightEl.min = 1; heightEl.max = 255; heightEl.value = this.image.height
        heightEl.addEventListener('input', (e) => {
            this.image.height = parseInt(heightEl.value)
            if (this.image.height > 1024)
                heightEl.value = this.image.height = 1024
            this.redrawCanvas()
            this.rebuildList()
        })

        let zoomEl = document.createElement('input')
        zoomEl.classList.add('zoom')
        let zoomInfoEl = document.createElement('span')
        zoomInfoEl.classList.add('zoom-info')
        zoomInfoEl.setAttribute('data-balloon', 'Zoom')
        zoomInfoEl.setAttribute('data-balloon-pos', 'top')

        zoomEl.type = 'range'
        zoomEl.min = 1; zoomEl.max = 48; zoomEl.step = 1
        zoomEl.value = this.canvasScale
        zoomInfoEl.innerText = Math.floor(this.canvasScale) + '.' +
                               Math.floor(this.canvasScale % 1 * 10) + '×'
        zoomEl.addEventListener('input', (e) => {
            this.canvasScale = parseInt(zoomEl.value)
            zoomInfoEl.innerText = Math.floor(this.canvasScale) + '.' +
                                   Math.floor(this.canvasScale % 1 * 10) + '×'
            this.redrawCanvas()
        })

        let sizeControlEl = document.createElement('div')
        sizeControlEl.classList.add('image-dimensions')
        sizeControlEl.appendChild(widthEl)
        sizeControlEl.appendChild(document.createTextNode('×'))
        sizeControlEl.appendChild(heightEl)
        controlsEl.appendChild(sizeControlEl)
        let zoomControlEl = document.createElement('div')
        zoomControlEl.classList.add('view-zoom')
        zoomControlEl.appendChild(zoomEl)
        zoomControlEl.appendChild(zoomInfoEl)
        controlsEl.appendChild(zoomControlEl)
    }
    updateControls() {
        let controlsEl = this.el.querySelector('.controls')

        let widthEl = controlsEl.querySelector('.width')
        widthEl.value = this.image.width
        let heightEl = controlsEl.querySelector('.height')
        heightEl.value = this.image.height

        let zoomEl = controlsEl.querySelector('.zoom')
        zoomEl.value = this.canvasScale
        let zoomInfoEl = controlsEl.querySelector('.zoom-info')
        zoomInfoEl.innerText = Math.floor(this.canvasScale) + '.' +
                               Math.floor(this.canvasScale % 1 * 10) + '×'
    }
    selectCommand(command) {
        if (command == null) {
            this.selectedCommand = null
            this.rebuildList()
            this.redrawCanvas()
        } else if (this.image.commands.indexOf(command) > -1) {
            this.selectedCommand = this.image.commands.indexOf(command)
            this.rebuildList()
            this.redrawCanvas()
        } else {
            console.warn('invalid command selection', command)
        }
    }
    getClosestPoint(points, x, y) {
        let distances = points.map(p => Math.sqrt(
            Math.pow(x - (p[0] * this.canvasScale), 2) +
            Math.pow(y - (p[1] * this.canvasScale), 2)
        ))
        let minDist = Math.min.apply(Math, distances)
        if (minDist < 6)
            return distances.indexOf(minDist)
        return null
    }
    mouseDownHandler(ev) {
        let currentCommand = this.image.commands[this.selectedCommand],
            type = currentCommand.getFriendlyName()
        if (this.selectedCommand !== null) {
            if (!this.altPressed && !this.shiftPressed)
                this.movingPoint = this.getClosestPoint(currentCommand.points,
                    ev.offsetX - this.canvasOffset[0],
                    ev.offsetY - this.canvasOffset[1])
            else if (this.altPressed && !this.shiftPressed) {
                if (type != 'circle') {
                    let midwayPoints = this.computeMidwayPoints(
                            currentCommand.points),
                        addIndex = this.getClosestPoint(midwayPoints,
                            ev.offsetX - this.canvasOffset[0],
                            ev.offsetY - this.canvasOffset[1])
                    if (addIndex !== null) {
                        currentCommand.points.splice(
                            addIndex, 0, midwayPoints[addIndex])
                        this.movingPoint = addIndex
                        this.redrawCanvas(ev)
                    }
                }
            } else if (!this.altPressed && this.shiftPressed) {
                if (type != 'circle') {
                    let deletePoint = this.getClosestPoint(
                        currentCommand.points,
                        ev.offsetX - this.canvasOffset[0],
                        ev.offsetY - this.canvasOffset[1])
                    if (deletePoint !== null &&
                        currentCommand.points.length > 2) {
                        currentCommand.points.splice(deletePoint, 1)
                        this.redrawCanvas(ev)
                        this.redrawCommandCanvas(this.image.commands[this.selectedCommand],
                            this.el.querySelector('.command-list')
                                .childNodes[this.selectedCommand].querySelector('canvas'))
                    }
                }
            }
        }
    }
    mouseUpHandler(ev) {
        if (this.image && this.movingPoint !== null)
            this.pushHistoryState()
        this.movingPoint = null
    }
    computeMidwayPoints(points) {
        let midwayPoints = points.map((a, i, list) =>
              i+1 >= list.length ? null
            : [(list[i][0] + list[i+1][0])/2, (list[i][1] + list[i+1][1])/2])
              .slice(0, -1)
        midwayPoints.unshift(points[0])
        midwayPoints.push(points[points.length - 1])
        return midwayPoints
    }
    drawHandle(ctx, point, offset, radius, fillColor, strokeColor) {
        ctx.fillStyle = fillColor
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(point[0] * this.pixelRatio * this.canvasScale + offset[0],
                    point[1] * this.pixelRatio * this.canvasScale + offset[1],
                    radius, radius, 0, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
    }
    redrawCommandCanvas(command, canvas) {
        // commandIndex : Number
        // canvas : Canvas
        if (!this.image) return
        canvas.height = this.image.height
        canvas.width = this.image.width
        let ctx = canvas.getContext('2d')
        ctx.fillStyle = '#F8F8F8'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        command.draw(ctx, 1, [0, 0], true)
    }
    redrawCanvas(ev) {
        if (!this.image) return
        this.canvas.height = (this.image.height + 2) * this.canvasScale * this.pixelRatio
        this.canvas.width = (this.image.width + 2) * this.canvasScale * this.pixelRatio
        this.canvas.style.height = (this.image.height + 2) * this.canvasScale + 'px'
        this.canvas.style.width = (this.image.width + 2) * this.canvasScale + 'px'
        let ctx = this.canvas.getContext('2d'),
            scale = this.canvasScale * this.pixelRatio
        this.canvasOffset = [0, 0]
        if (this.selectedCommand !== null) {
            if (ev && this.movingPoint !== null && 'offsetX' in ev) {
                let command = this.image.commands[this.selectedCommand],
                    snappingFactor = 1
                if (command.getFriendlyName() == 'precise-path')
                    snappingFactor = 8
                command.points[this.movingPoint] =
                    [Math.round((ev.offsetX - this.canvasOffset[0]) / this.canvasScale * snappingFactor) / snappingFactor,
                     Math.round((ev.offsetY - this.canvasOffset[1]) / this.canvasScale * snappingFactor) / snappingFactor]

                this.redrawCommandCanvas(this.image.commands[this.selectedCommand],
                    this.el.querySelector('.command-list')
                        .childNodes[this.selectedCommand].querySelector('canvas'))
            }
        }
        for (let command of this.image.commands) {
            command.draw(ctx, scale, this.canvasOffset)
        }
        if (this.selectedCommand !== null && this.image.commands[this.selectedCommand]) {
            let closestPoint,
                command = this.image.commands[this.selectedCommand],
                selectablePoints = command.points,
                midwayPoints = this.computeMidwayPoints(selectablePoints)
            if (!this.altPressed && !(this.shiftPressed && command.getFriendlyName() == 'circle')) {
                if (ev && this.movingPoint === null && 'offsetX' in ev)
                    closestPoint = this.getClosestPoint(selectablePoints,
                        ev.offsetX - this.canvasOffset[0],
                        ev.offsetY - this.canvasOffset[1])
                for (let pointIndex in selectablePoints) {
                    let radius = (this.movingPoint === null &&
                        closestPoint === parseInt(pointIndex) ? 7 : 3)
                    this.drawHandle(ctx, selectablePoints[pointIndex],
                        this.canvasOffset,
                        radius, this.shiftPressed ? '#D00' : '#0DD',
                        this.shiftPressed ? '#A00' : '#0AA')
                }
            } else if (this.altPressed && !this.shiftPressed) {
                if (command.getFriendlyName() != 'circle') {
                    if (ev && this.movingPoint === null && 'offsetX' in ev)
                        closestPoint = this.getClosestPoint(midwayPoints,
                            ev.offsetX - this.canvasOffset[0],
                            ev.offsetY - this.canvasOffset[1])
                    for (let pointIndex in midwayPoints) {
                        let radius = (this.movingPoint === null &&
                                closestPoint === parseInt(pointIndex) ? 7 : 3)
                        this.drawHandle(ctx, midwayPoints[pointIndex],
                            this.canvasOffset, radius, '#0D0', '#0A0')
                    }
                }
            }
            if (this.movingPoint !== null) {
                this.drawHandle(ctx, selectablePoints[this.movingPoint],
                    this.canvasOffset, 7, '#00D', '#00A')
            }
        }
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)'
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'
        ctx.lineWidth = 1
        ctx.beginPath()
        // horizontal midline
        ctx.moveTo(0, (this.image.height + 2) * scale / 2)
        ctx.lineTo((this.image.width + 2) * scale,
                   (this.image.height + 2) * scale / 2)
        // vertical midline
        ctx.moveTo((this.image.width + 2) * scale / 2, 0)
        ctx.lineTo((this.image.width + 2) * scale / 2,
                  (this.image.height + 2) * scale)
        // image border
        ctx.moveTo(1 * scale, 1 * scale)
        ctx.lineTo((this.image.width + 1) * scale,
                   1 * scale)
        ctx.lineTo((this.image.width + 1) * scale,
                   (this.image.height + 1) * scale)
        ctx.lineTo(1 * scale,
                   (this.image.height + 1) * scale)
        ctx.lineTo(1 * scale, 1 * scale)
        ctx.stroke()
        if (scale >= 16) {
            for (let x = 0.5; x < this.image.width; x++)
                for (let y = 0.5; y < this.image.height; y++) {
                    ctx.beginPath()
                    ctx.fillRect((x + 1) * scale - 1,
                                (y + 1) * scale - 1,
                                2, 2)
                    ctx.fill()
                }
        }
    }
}
