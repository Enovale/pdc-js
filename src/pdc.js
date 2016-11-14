'use strict';

let getRGBA = function(pebbleColor) {
    // pebbleColor: Number
    return 'rgba(' + (pebbleColor >> 4 & 3) / 3 * 255 + ',' +
                     (pebbleColor >> 2 & 3) / 3 * 255 + ',' +
                     (pebbleColor >> 0 & 3) / 3 * 255 + ',' +
                     (pebbleColor >> 6 & 3) / 3 * 1 + ')'
}

class PDCCommand {
    constructor() {
        this.flags = {'hidden': false}
        this.strokeColor = 0
        this.strokeWidth = 0
        this.fillColor = 0
        this.points = []
    }
    toString() {
        return '-=-=-=- ' + this.constructor.name + ' -=-=-=-' +
             '\nHidden: ' + this.flags.hidden +
             '\nStroke Color: ' + this.strokeColor +
             '\nStroke Width: ' + this.strokeWidth +
             '\nFill Color: ' + this.fillColor +
             (typeof this.pathOpen != 'undefined'
                 ? '\nPath Open: ' + this.pathOpen : '') +
             (typeof this.radius != 'undefined'
                 ? '\nRadius: ' + this.radius : '') +
             '\nPoints: ' + JSON.stringify(this.points)
    }
    getFriendlyName() {
        return 'Generic Command'
    }
    getTextRepresentation() {
        return this.getFriendlyName()
    }
    setOwnStyleOntoContext(ctx, scale) {
        // ctx: CanvasRenderingContext2D
        // scale: Number
        ctx.strokeStyle = getRGBA(this.strokeColor)
        ctx.lineWidth = this.strokeWidth * scale
        ctx.fillStyle = getRGBA(this.fillColor)
    }
    equals(cmd) {
        if (cmd.fillColor != this.fillColor ||
            cmd.strokeColor != this.strokeColor ||
            cmd.strokeWidth != this.strokeWidth ||
            cmd.flags.hidden != this.flags.hidden ||
            cmd.pathOpen != this.pathOpen ||
            cmd.points.length != this.points.length)
            return false
        if (cmd.getFriendlyName() != this.getFriendlyName())
            return false
        if (this.getFriendlyName() == 'circle') {
            if (cmd.radius != this.radius)
                return false
        } else {
            if (cmd.pathOpen != this.pathOpen)
                return false
        }
        for (let point in this.points)
            if (cmd.points[point][0] != this.points[point][0] ||
                cmd.points[point][1] != this.points[point][1])
                return false
        return true
    }
}

class PDCCircleCommand extends PDCCommand {
    constructor() {
        super()
        this.radius = 0
    }
    clone() {
        let c = new PDCCircleCommand()
        c.flags = {'hidden': this.flags.hidden}
        c.radius = this.radius
        c.strokeColor = this.strokeColor
        c.strokeWidth = this.strokeWidth
        c.fillColor = this.fillColor
        for (let point of this.points) {
            c.points.push(point.slice(0))
        }
        return c
    }
    getFriendlyName() {
        return 'circle'
    }
    draw(ctx, scale, offset, force) {
        // ctx: CanvasRenderingContext2D
        // scale: Number
        // offset: [Number, Number] -- optional
        // force: Boolean
        if (this.flags.hidden && !force) return
        if (!offset) offset = [0, 0]
        this.setOwnStyleOntoContext(ctx, scale)
        for (let point of this.points) {
            ctx.beginPath()
            ctx.ellipse(point[0] * scale + offset[0], point[1] * scale + offset[1],
                this.radius * scale + offset[0], this.radius * scale + offset[1],
                0, 0, 2 * Math.PI)
            ctx.fill()
            ctx.stroke()
        }
    }
}

class PDCPathCommand extends PDCCommand {
    constructor() {
        super()
        this.pathOpen = false
    }
    getFriendlyName() {
        return 'path'
    }
    clone() {
        let c = new PDCPathCommand()
        c.flags = {'hidden': this.flags.hidden}
        c.pathOpen = this.pathOpen
        c.strokeColor = this.strokeColor
        c.strokeWidth = this.strokeWidth
        c.fillColor = this.fillColor
        for (let point of this.points) {
            c.points.push(point.slice(0))
        }
        return c
    }
    draw(ctx, scale, offset, force) {
        // ctx: CanvasRenderingContext2D
        // scale: Number
        // offset: [Number, Number] -- optional
        // force: Boolean
        if (this.flags.hidden && !force) return
        if (!offset) offset = [0, 0]
        this.setOwnStyleOntoContext(ctx, scale)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(this.points[0][0] * scale + offset[0],
                   this.points[0][1] * scale + offset[1])
        for (let point of this.points.slice(1)) {
            ctx.lineTo(point[0] * scale + offset[0],
                       point[1] * scale + offset[1])
        }
        if (!this.pathOpen) {
            ctx.closePath()
        }
        ctx.fill()
        ctx.stroke()
    }
    toPrecise() {
        var p = new PDCPrPathCommand()
        p.pathOpen = this.pathOpen
        p.flags = this.flags
        p.strokeColor = this.strokeColor
        p.strokeWidth = this.strokeWidth
        p.fillColor = this.fillColor
        p.points = this.points
        return p
    }
}

class PDCPrPathCommand extends PDCPathCommand {
    constructor() {
        super()
    }
    getFriendlyName() {
        return 'precise-path'
    }
    clone() {
        let c = new PDCPrPathCommand()
        c.flags = {'hidden': this.flags.hidden}
        c.pathOpen = this.pathOpen
        c.strokeColor = this.strokeColor
        c.strokeWidth = this.strokeWidth
        c.fillColor = this.fillColor
        for (let point of this.points) {
            c.points.push(point.slice(0))
        }
        return c
    }
    toPath() {
        var p = new PDCPathCommand()
        p.pathOpen = this.pathOpen
        p.flags = this.flags
        p.strokeColor = this.strokeColor
        p.strokeWidth = this.strokeWidth
        p.fillColor = this.fillColor
        p.points = this.points.map(a => a.map(Math.round))
        return p
    }
}

class PDCImage {
    constructor() {
        this.height = 0
        this.width = 0
        this.version = 1
        this.commands = []
    }
    clone() {
        var img = new PDCImage()
        img.height = this.height
        img.width = this.width
        img.version = this.version
        for (let command of this.commands)
            img.commands.push(command.clone())
        return img
    }
    equals(img) {
        if (img.height != this.height ||
            img.width != this.width ||
            img.version != this.version ||
            img.commands.length != this.commands.length)
            return false
        for (let command in this.commands)
            if (!this.commands[command].equals(img.commands[command]))
                return false
        return true
    }
    getBinaryRepresentation() {
        let gen = new PDCGenerator()
        return gen.binarizeImage(this)
    }
}

// TODO: class PDCSequence
// TODO: class PDCFrame

class PDCGenerator {
    constructor() {
    }
    generateDrawCommandImage(img) {
        // https://developer.pebble.com/guides/app-resources/pdc-format/#pebble-draw-command-image
        let output = [img.version, 0]
        output = output.concat(this.int(img.width, 2, 'u'))
        output = output.concat(this.int(img.height, 2, 'u'))
        output = output.concat(this.int(img.commands.length, 2, 'u'))
        for (let command of img.commands) {
            let type = command.getFriendlyName()
            output.push({'path': 1, 'circle': 2, 'precise-path': 3}[type])
            output = output.concat(this.int(command.flags.hidden ? 1 : 0, 1, 'u'))
            output = output.concat(this.int(command.strokeColor, 1, 'u'))
            output = output.concat(this.int(command.strokeWidth, 1, 'u'))
            output = output.concat(this.int(command.fillColor, 1, 'u'))
            if (type == 'circle')
                output = output.concat(this.int(command.radius, 2, 'u'))
            else
                output = output.concat(this.int(command.pathOpen, 2, 'u'))
            output = output.concat(this.int(command.points.length, 2, 'u'))
            for (let point of command.points) {
                let scaleFactor = (type == 'precise-path' ? 8 : 1),
                    x = Math.round(point[0] * scaleFactor),
                    y = Math.round(point[1] * scaleFactor)
                output = output.concat(this.int(x, 2, 'u'))
                output = output.concat(this.int(y, 2, 'u'))
            }
        }
        return output
    }
    binarizeImage(img) {
        let output = this.b('PDCI'),
            data = this.generateDrawCommandImage(img)
        output = output.concat(this.int(data.length, 4, 'u'))
        output = output.concat(data)
        return this.c(output)
    }
    int(num, bytes, format) {
        num = Math.round(num)
        if (bytes == 1 && format == 'u')
            return [num & 0xFF]
        if (bytes == 1 && format == 'i')
            return [((num % 128) + 256)  & 0xFF]
        if (bytes == 2 && format == 'u')
            return [num % 256, num >> 8]
        if (bytes == 2 && format == 'i')
            return [num % 256, ((Math.floor(num / 256) % 128) + 256) % 256]
        if (bytes == 4 && format == 'u')
            return [num % 256, num >> 8, num >> 16, num >> 24]
    }
    b(str) {
        let out = []
        for (let c of str)
            out.push(c.charCodeAt(0))
        return out
    }
    c(arr) {
        let str = []
        for (let c of arr)
            str.push(String.fromCharCode(c))
        return str.join('')
    }
}

class PDCParser {
    constructor() {
    }
    parse(binary) {
        if (this.readMagicWord(binary) != 'PDCI')
            throw Error('Unsupported magic word')
        let pdci = new PDCImage()
        pdci.width = this.int([binary[10], binary[11]], 'i')
        pdci.height = this.int([binary[12], binary[13]], 'i')
        pdci.version = this.int(binary[8], 'u')
        pdci.commands = this.parseList(binary.slice(14))
        return pdci
    }
    parseList(binary) {
        // binary: String
        let list = []
        let commandAmount = this.int([binary[0], binary[1]], 'u')
        binary = binary.slice(2)
        let offset = 0
        for (let i = 0; i < commandAmount; i++) {
            let commandType = [
                null, PDCPathCommand, PDCCircleCommand, PDCPrPathCommand]
                [this.int(binary[0], 'u')]
            if (!commandType)
                throw Error('Invalid command type', binary)
            let command = new commandType()
            command.flags.hidden = this.bool(this.b(binary[1]) & 1)
            command.strokeColor = this.int(binary[2], 'u')
            command.strokeWidth = this.int(binary[3], 'u')
            command.fillColor = this.int(binary[4], 'u')
            if (commandType == PDCCircleCommand) {
                command.radius = this.int([binary[5], binary[6]], 'u')
            } else {
                command.pathOpen =
                    this.bool((this.b(binary[5]) + this.b(binary[6])) & 1)
            }
            let pointAmount = this.int([binary[7], binary[8]], 'u')
            binary = binary.slice(9)
            command.points = this.parsePoints(binary.slice(0, 4 * pointAmount),
                commandType == PDCPrPathCommand ? 1/8 : 1)
            list.push(command)
            binary = binary.slice(4 * pointAmount)
            offset += 9 + 4 * pointAmount
        }
        return list
    }
    parsePoints(binary, scale) {
        let points = []
        for (let i = 0; i < binary.length / 4; i++) {
            points.push([scale * this.int([binary[i*4], binary[i*4+1]], 'i'),
                         scale * this.int([binary[i*4+2], binary[i*4+3]], 'i')])
        }
        return points
    }
    b(string) {
        return string.charCodeAt(0)
    }
    int(bytes, format) {
        if (typeof bytes == 'string')
            bytes = [bytes]
        if (typeof bytes[0] == 'string')
            bytes = bytes.map(this.b)
        if (format == 'u' && bytes.length == 1)
            return bytes[0]
        else if (format == 'i' && bytes.length == 1)
            return (bytes[0] < 128
                   ? bytes[0]
                   : -256+bytes[0])
        else if (format == 'u' && bytes.length == 2)
            return (bytes[1] * 256 + bytes[0])
        else if (format == 'i' && bytes.length == 2)
            return (bytes[1] < 128
                    ? bytes[1] * 256 + bytes[0]
                    : -65536+(bytes[1] * 256 + bytes[0]))
    }
    bool(byte) {
        if (typeof byte == 'string')
            byte = this.b(byte)
        return (byte != 0)
    }
    readMagicWord(binary) {
        return binary.slice(0, 4)
    }
}
