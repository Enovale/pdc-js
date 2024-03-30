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
    return a.values[0] == b.values[0] && a.values[1] == b.values[1];
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
            path: this.parsePath,
            circle: this.parseCircle,
            polyline: this.parsePolyLine,
            polygon: this.parsePolygon,
            line: this.parseLine,
            rect: this.parseRect
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
        let translate = new Vector2(-viewBox.x, -viewBox.y);
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
                    this.groupFill = attr(child, "fill")?.match(/[\d\.]{1,3}/g);
                    this.groupFillOpacity = attr(child, "fill-opacity");
                    this.groupStroke = attr(child, "stroke")?.match(/[\d\.]{1,3}/g);
                    this.groupStrokeOpacity = attr(child, "stroke-opacity");
                    this.groupStrokeWidth = attr(child, "stroke-width");

                    if (this.groupStrokeWidth) {
                        this.groupStrokeWidth = parseInt(this.groupStrokeWidth.filter(c => '0123456789.'.contains(c)));
                        this.groupStrokeWidth = this.groupStrokeWidth >= 1 ? this.groupStrokeWidth : 1;
                    }

                    let transform = attr(child, "transform");
                    if (transform.baseVal.length > 0) {
                        throw Error("You've found an SVG that actually uses this transform thing that's in the pebble code. Send it to me.")
                    }
                }
                let childTranslate = this.getTranslate(child);
                translate = new Vector2(translate.x + childTranslate.x, translate.y + childTranslate.y);
                let cmdList = this.parseCommands(child, translate, truncateColor);
                commands = commands.concat(cmdList);
            } else {
                let childTranslate = translate;
                let transform = attr(child, "transform");
                if (transform && transform.baseVal.length > 0) {
                    throw Error("SVG Transform error but the second time, please send me your SVG.");
                }
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
        if (style) {
            attributes = style;
        }

        let opacity = attr(attributes, "opacity");
        let stroke = attr(attributes, "stroke")?.match(/[\d\.]{1,3}/g);
        let strokeOpacity = attr(attributes, "stroke-opacity");
        let fill = attr(attributes, "fill")?.match(/[\d\.]{1,3}/g);
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
        let translate = attr(group, "translate");
        if (translate) {
            throw Error("Please send me this SVG that seems to have a translate in it.");
            let pos = group.getElementsByTagName("translate");
            if (pos != null && pos.length > 0 && pos[0] != null){
                pos = pos[0];
            }
        }

        return new Vector2(0, 0);
    }
    parsePath(element, translate, strokeWidth, strokeColor, fillColor) {
        let path = element.getPathData({normalize: true});
        if (!path || path.length <= 0) {
            console.warn("Path element does not have data!");
            return null;
        }
        
        let last = path[path.length - 1];
        let pathOpen = !"Zz".includes(last.type);

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
            points.push(path[i].values);
        }

        var p = new PDCPrPathCommand();
        p.flags = {'hidden': false};
        p.pathOpen = pathOpen;
        p.strokeColor = strokeColor;
        p.strokeWidth = strokeWidth;
        p.fillColor = fillColor;
        p.points = points;
        return p;
    }
}

class Vector2 {
    constructor(x, y) {
        this.x;
        this.y;
    }
}