'use strict';

function generateHelpButton() {
    let helpButton = document.createElement('button')
    helpButton.classList.add('help-button', 'pinging')
    helpButton.innerHTML = '<i class="icon icon-help"></i>'
    helpButton.addEventListener('click', e => {
        helpButton.classList.remove('pinging')
        e.stopPropagation();
        showHelp();
    }, false)
    return helpButton
}

function showHelp() {
    let helpDialog = document.createElement('div')
    helpDialog.classList.add('modal', 'help-modal')
    helpDialog.innerHTML =
        '<button class="close-modal"><i class="icon-lg icon-close"></i></button>\
        <h1>Hotkeys</h1>\
        <ul>\
            <li>Undo: <code>⌘Z</code> (or <code>⌃Z</code>)</li>\
            <li>Redo: <code>⌘⇧Z</code> (or <code>⌃⇧Z</code> or <code>⌃Y</code>)</li>\
        </ul>\
        <h1>File IO</h1>\
        <ul>\
            <li>To open a new file, drag it to the bar at the top of the screen.</li>\
            <li>To create a blank file, click the <i class="icon icon-new"></i> button.</li>\
            <li>To save the current file, click the <i class="icon icon-download"></i> button.</li>\
        </ul>\
        <h1>When editing paths:</h1>\
        <ul>\
            <li>Drag nodes to move them</li>\
            <li>Use <b>alt</b> to insert nodes</li>\
            <li>Use <b>shift</b> to delete nodes</li>\
        </ul>\
        <h1>Sidebar</h1>\
        <ul>\
            <li>Drag items to rearrange them</li>\
            <li>Select items to edit further details</li>\
            <li>Use <i class="icon icon-make-path"></i> and\
                <i class="icon icon-make-precise"></i> to toggle path precision</li>\
            <li>Note: in PDC, commands earlier in the file (and therefore\
                higher up in the sidebar) are drawn first (below others).</li>\
            <li>Use the zoom slider to magnify the image. Depending on your\
                browser and computer, you may be able to use pinch-to-zoom.</li>\
        </ul>\
        <p></p>\
        '
    helpDialog.querySelector('.close-modal').addEventListener('click', e => {
        closeHelp()
    })
    helpDialog.querySelector('p:last-of-type').appendChild(generateExampleFileLoader())
    document.body.appendChild(helpDialog)
}

function closeHelp() {
    let helpDialogs = document.querySelectorAll('.help-modal')
    for (let helpDialog of helpDialogs)
        helpDialog.parentNode.removeChild(helpDialog)
}

function generateExampleFileLoader() {
    let button = document.createElement('button')
    button.classList.add('stealth')
    button.innerText = 'Load example file'
    button.addEventListener('click', e => {
        window.picker.loadData('PDCI\u0002\u0001\u0000\u0000\u0001\u0000K\u0000K\u0000\u0006\u0000\u0003\u0000À\u0005\u0000\u0001\u0000\u0002\u0000Î\u0000V\u0000Î\u0000\u0000\u0003\u0000À\u0005\u0000\u0001\u0000\u0002\u0000\u0012\u0000\u0012\u0001N\u0000\u0012\u0001\u0002\u0000À\u0005ÿ\n\u0000\u0001\u0000\u001a\u0000\"\u0000\u0003\u0000À\u0005\u0000\u0001\u0000\u0002\u0000s\u0000¹\u0000I\u0000\u0000\u0003\u0000À\u0005\u0000\u0001\u0000\u0002\u0000)\u0001¸\u0000S\u0001\u0000\u0003\u0000À\u0005ÿ\u0000\u0000(\u0000]\u0001\u0006\u00015\u0001\r\u0001\u001e\u0001\u0019\u0001\u0007\u0001,\u0001þ\u00009\u0001ö\u0000I\u0001%\u0001u\u0001\u0003\u0001U\u0001Ý\u0000E\u0001¹\u0000E\u0001\u0000L\u0001\u0000[\u0001u\u0000o\u0001m\u0000\u0001j\u0000\u0001o\u0000´\u0001|\u0000Ì\u0001\u0000Ý\u0001º\u0000è\u0001×\u0001è\u0001â\u0001ç\u0001û\u0001Þ\u0001\n\u0002Ð\u0001\u0014\u0002¾\u0001\u0018\u0002¨\u0001\u0016\u0002\u0001\u0010\u0002\u0001\u0007\u0002}\u0001û\u0001r\u0001ì\u0001k\u0001×\u0001h\u0001¶\u0001\u0001É\u0001u\u0001Ì\u0001b\u0001Ë\u0001Z\u0001Ä\u0001I\u0001³\u0001.\u0001 \u0001\u001c\u0001\u0001\u0011\u0001w\u0001\t\u0001', 'Partly Cloudy')
        closeHelp()
    })
    return button
}
