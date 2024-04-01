'use strict';

/*
    Taken from pebble_image_routines.py
*/
let nearestColor = function(r, g, b, a) {
    a = ((a + 42) / 85) * 85;

    if (a == 0) {
        [r, g, b] = [0, 0, 0];
    } else {
        r = ((r + 42) / 85) * 85;
        g = ((g + 42) / 85) * 85;
        b = ((b + 42) / 85) * 85;
    }

    return [r, g, b, a];
}

/*
    Taken from pebble_image_routines.py
*/
let truncateColor = function(r, g, b, a) {
    a = (a/ 85) * 85;

    if (a == 0) {
        [r, g, b] = [0, 0, 0];
    } else {
        r = (r / 85) * 85;
        g = (g / 85) * 85;
        b = (b / 85) * 85;
    }

    return [r, g, b, a];
}

/*
    Taken from pebble_image_routines.py
*/
let toARGB = function(r, g, b, a) {
    [a, r, g, b] = [a >> 6, r >> 6, g >> 6, b >> 6];
    let argb8 = (a << 6) | (r << 4) | (g << 2) | b;
    return argb8;
}

let attr = function(element, name) {
    return element[name] ?? element.attributes[name]?.value;
}

let comparePoints = function(a, b) {
    if (!a || !b) {
        return false;
    }

    return a.values[0] == b.values[0] && a.values[1] == b.values[1];
}

let addPointArray = function(arr, d) {
    let array = arr;
    for (let i = 0; i < arr.length; i++) {
        array[i] = addPoints(arr[i], d);
    }

    return array;
}

let addPoints = function(a, b) {
    if (!a || !b) {
        return null;
    }

    return [a[0] + b[0], a[1] + b[1]];
}

let normalizeColor = function(str) {
    if (!str || str == "") {
        return null;
    }

    let r, g, b;
    if (str.startsWith("#")) {
        let rgb = parseInt(str.slice(1, 7), 16);
        [r, g, b] = [(rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF];
    } else if (str.startsWith("rgb(")) {
        [r, g, b] = str.match(/[\d\.]{1,3}/g);
    } else {
        return null;
    }

    return [r, g, b];
}

class SVGParser {
    constructor() {
        this.xmlDoc = null;
        this.groupOpacity;
        this.groupFill;
        this.groupFillOpacity;
        this.groupStroke;
        this.groupStrokeOpacity;
        this.groupStrokeWidth;
        this.parserMap = {
            path: this.parsePath.bind(this),
            circle: this.parseCircle.bind(this),
            polyline: this.parsePolyLine.bind(this),
            polygon: this.parsePolygon.bind(this),
            line: this.parseLine.bind(this),
            rect: this.parseRect.bind(this)
        }
    }
    isSVG(text) {
        if (window.DOMParser) {
            let parser = new DOMParser();
            this.xmlDoc = parser.parseFromString(text, "image/svg+xml");
        }
        else // Internet Explorer
        {
            this.xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
            this.xmlDoc.async = false;
            this.xmlDoc.loadXML(text);
        }

        if (this.xmlDoc == null || this.xmlDoc.querySelector("parsererror")) {
            return false;
        }

        if (this.xmlDoc.documentElement.nodeName != "svg") {
            return false;
        }

        return true;
    }
    parse(text) {
        if (this.xmlDoc == null) {
            if (!this.isSVG(text)) {
                throw Error("Document is not a proper SVG!");
            }
        }

        console.log(this.xmlDoc.documentElement);

        let viewBox = this.getViewBox(this.xmlDoc.documentElement);
        let translate = [-viewBox.baseVal.x, -viewBox.baseVal.y];
        let commands = this.parseCommands(this.xmlDoc.documentElement, translate);
        
        console.log(commands);
        
        let pdci = new PDCImage()
        pdci.width = viewBox.baseVal.width;
        pdci.height = viewBox.baseVal.height;
        pdci.version = 1
        pdci.commands = commands;
        return pdci;
    }
    parseCommands(group, translate, truncateColor = true) {
        let commands = [];

        for (let i = 0; i < group.children.length; i++) {
            let child = group.children[i];
            let display = attr(child, "display");
            if (display && display == "none") {
                continue;
            }

            if (child.nodeName == "layer" || child.nodeName == "g") {
                if (child.nodeName == "g") {
                    this.groupOpacity = attr(child, "opacity");
                    this.groupFill = normalizeColor(attr(child, "fill"));
                    this.groupFillOpacity = attr(child, "fill-opacity");
                    this.groupStroke = normalizeColor(attr(child, "stroke"));
                    this.groupStrokeOpacity = attr(child, "stroke-opacity");
                    this.groupStrokeWidth = attr(child, "stroke-width");

                    if (this.groupStrokeWidth) {
                        this.groupStrokeWidth = parseInt(this.groupStrokeWidth.filter(c => '0123456789.'.contains(c)));
                        this.groupStrokeWidth = this.groupStrokeWidth >= 1 ? this.groupStrokeWidth : 1;
                    }
                }
                let childTranslate = addPoints(translate, this.getTranslate(child));
                let cmdList = this.parseCommands(child, childTranslate, truncateColor);
                commands = commands.concat(cmdList);
            } else {
                let childTranslate = addPoints(translate, this.getTranslate(child));
                let c = this.createCommand(childTranslate, child, truncateColor);
                if (c) {
                    commands.push(c);
                }
            }
        };

        return commands;
    }
    createCommand(translate, element, truncateColor = true) {
        let style = element["style"];
        let attributes = element;
        if (style && style.length > 0) {
            attributes = style;
        }

        let opacity = attr(attributes, "opacity");
        let stroke = normalizeColor(attr(attributes, "stroke"));
        let strokeOpacity = attr(attributes, "stroke-opacity");
        let fill = normalizeColor(attr(attributes, "fill"));
        let fillOpacity = attr(attributes, "fill-opacity");
        
        opacity ??= this.groupOpacity;
        stroke ??= this.groupStroke;
        strokeOpacity ??= this.groupStrokeOpacity;
        fill ??= this.groupFill;
        fillOpacity ??= this.groupFillOpacity;

        let strokeColor = this.parseColor(stroke, this.calcOpacity(strokeOpacity, opacity), truncateColor);
        let fillColor = this.parseColor(fill, this.calcOpacity(fillOpacity, opacity), truncateColor);

        let strokeWidth = parseInt(attr(attributes, "stroke-width"));
        if (isNaN(strokeWidth)) {
            strokeWidth = 0;
        }
        strokeWidth ??= this.groupStrokeWidth ?? 1;

        if (strokeColor == 0 && fillColor == 0) {
            return null;
        }

        if (strokeColor == 0) {
            strokeWidth = 0;
        } else if (strokeWidth == 0) {
            strokeColor = 0;
        }

        let parser = this.parserMap[element.nodeName];

        if (!parser) {
            console.warn("Unsupported node type: " + element.nodeName);
            return null;
        }

        let node = parser(element, translate, strokeWidth, strokeColor, fillColor);
        if (node) {
            return node;
        } else {
            console.warn("Failed to parse: " + element.nodeName);
        }

        return null;
    }
    convertColor(r, g, b, a, truncate = true) {
        if (truncate) {
            [r, g, b, a] = truncateColor(r, g, b, a);
        } else {
            [r, g, b, a] = nearestColor(r, g, b, a);
        }

        return toARGB(r, g, b, a);
    }
    calcOpacity(a, b) {
        a = parseFloat(a);
        if (!a || isNaN(a)) {
            a = 1.0;
        }
        b = parseFloat(b);
        if (!b || isNaN(b)) {
            b = 1.0;
        }

        return a * b;
    }
    parseColor(color, opacity, truncateColor) {
        if (!color || color.length < 3) {
            return 0;
        }

        let a = parseInt(opacity * 255);

        return this.convertColor(color[0], color[1], color[2], a, truncateColor);
    }
    getViewBox(root) {
        let viewBox = attr(root, "viewBox");
        if (viewBox) {
            return viewBox
        } else {
            return new SVGRect(0, 0, attr(root, "width"), attr(root, "height"));
        }
    }
    getTranslate(group) {
        let transform = attr(group, "transform");
        let translate = [0, 0];
        if (transform && transform.baseVal.length > 0) {
            translate = this.getTranslateFromTransform(transform) ?? translate;
        }

        return translate;
    }
    getTranslateFromTransform(transform) {
        for (let j = 0; j < transform.baseVal.length; j++) {
            let transformation = transform.baseVal[j];
            if (transformation.type == 2) {
                let matrix = transformation.matrix;
                return [matrix.e, matrix.f];
            }
        }

        return null;
    }
    parsePath(element, translate, strokeWidth, strokeColor, fillColor) {
        let path = element.getPathData({normalize: true});
        if (!path || path.length <= 0) {
            console.warn("Path element does not have data!");
            return null;
        }
        
        let last = path[path.length - 1];
        let pathOpen = last.type != "Z";

        if (pathOpen) {
            path.slice(0, path.lenth - 1);
            path.push({
                type: "L",
                values: path[path.length - 1].values
            });
        }

        if (comparePoints(path[0], path[path.length - 1])) {
            path.pop();
        }

        let points = [];
        for (let i = 0; i < path.length; i++) {
            points.push(addPoints(path[i].values, translate));
        }

        let p = new PDCPrPathCommand();
        p.flags = {'hidden': false};
        p.pathOpen = pathOpen;
        p.strokeColor = strokeColor;
        p.strokeWidth = strokeWidth;
        p.fillColor = fillColor;
        p.points = points;
        return p;
    }
    parseCircle(element, translate, strokeWidth, strokeColor, fillColor) {
        let c = new PDCCircleCommand();
        let cx = parseFloat(attr(element, "cx"));
        let cy = parseFloat(attr(element, "cy"));
        c.radius = parseFloat(attr(element, "r")) ?? parseFloat(attr(element, "z"));

        if (!cx || !cy || !c.radius || isNaN(cx) || isNaN(cy) || isNaN(c.radius)) {
            console.warn("Unrecognized circle format");
            return null;
        }

        c.flags = {'hidden': false};
        c.strokeColor = strokeColor;
        c.strokeWidth = strokeWidth;
        c.fillColor = fillColor;
        c.points = [addPoints([cx, cy], translate)];

        return c;
    }
    parsePolyLine(element, translate, strokeWidth, strokeColor, fillColor) {
        return this.getPolygonFromElement(element, translate, strokeWidth, strokeColor, fillColor, true);
    }
    parsePolygon(element, translate, strokeWidth, strokeColor, fillColor) {
        return this.getPolygonFromElement(element, translate, strokeWidth, strokeColor, fillColor, false);
    }
    parseLine(element, translate, strokeWidth, strokeColor, fillColor) {
        let points = [[element.x1.baseVal.value, element.y1.baseVal.value],
                      [element.x2.baseVal.value, element.y2.baseVal.value]];

        let p = new PDCPrPathCommand();
        p.flags = {'hidden': false};
        p.pathOpen = true;
        p.strokeColor = strokeColor;
        p.strokeWidth = strokeWidth;
        p.fillColor = fillColor;
        p.points = addPointArray(points, translate);
        
        return p;
    }
    parseRect(element, translate, strokeWidth, strokeColor, fillColor) {
        let [origin, width, height] = [[element.x.baseVal.value, element.y.baseVal.value], element.width.baseVal.value, element.height.baseVal.value];

        let points = [origin, addPoints(origin, [width, 0]), addPoints(origin, [width, height]),
                      addPoints(origin, [0, height])];

        let p = new PDCPrPathCommand();
        p.flags = {'hidden': false};
        p.pathOpen = false;
        p.strokeColor = strokeColor;
        p.strokeWidth = strokeWidth;
        p.fillColor = fillColor;
        p.points = addPointArray(points, translate);

        return p;
    }
    getPolygonFromElement(element, translate, strokeWidth, strokeColor, fillColor, pathOpen) {
        let points = [];
        for (let i = 0; i < element.points.length; i++) {
            let point = element.points[i];
            points.push([point.x, point.y]);
        }

        if (points.length <= 0) {
            return null;
        }

        let p = new PDCPrPathCommand();
        p.flags = {'hidden': false};
        p.pathOpen = pathOpen;
        p.strokeColor = strokeColor;
        p.strokeWidth = strokeWidth;
        p.fillColor = fillColor;
        p.points = addPointArray(points, translate);

        return p;
    }
}