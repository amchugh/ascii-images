
/// <reference path="helloworld.ts" />
/// <reference path="imagemanip.ts" />
/// <reference path="navigation.ts" />

const config = {
    srcVideoWidth: '400px',
    srcVideoHeight: '400px',
    gaussianKernel: {
        kernel: [2, 4, 5, 4, 2, 4, 9, 12, 9, 4, 5, 12, 15, 12, 5, 4, 9, 12, 4, 9, 2, 4, 5, 4, 2],
        size: 5
    },
    doubleThreshold: {
        highValue: 200,
        lowValue: 150,
        highThreshold: 70,
        lowThreshold: 15
    },
    borderSize: 2,
    edgeInfluence: 0.1,
    bwInfluence: 0.8,
    suppressedInfluence: 0.3,
    asciiCharacters: [' ', '.', ',', '!', '*', 'o', 'O', '8', '#', '@'],
    fontSize: 16,
    fontName: "Courier New",
    desiredOutputLines: 60,
    ratios: {
        video: 4 / 3,
    },
    fontString: function() : string {
        return this.fontSize + "px " + this.fontName;
    }
}

function calculateTextRatio() : number {
    const canv = document.createElement("canvas");
    const cont = canv.getContext("2d");
    cont.font = config.fontString()
    const metrics = cont.measureText("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    return metrics.width / 26 / config.fontSize
}

function getOutputTextSize() : [number, number] {
    const height = config.desiredOutputLines;
    const width = Math.floor(height * config.ratios.video / calculateTextRatio());
    return [width, height];
}

function getOutputImageSize() : [number, number] {
    const [tw, th] = getOutputTextSize();
    const width = tw * config.fontSize * calculateTextRatio();
    const height = th * config.fontSize;
    return [width, height];
}

function valuesToAscii(data: Int32Array, width : number, range : number = 255) {
    let str = ""
    for (let i = 0; i < data.length; i++) {
        let val = data[i];
        let index;
        if (val == 0) 
            index = 0;
        else 
            index = config.asciiCharacters.length - 
                Math.ceil(val / range * config.asciiCharacters.length);
        str += config.asciiCharacters[index];
        if (((i + 1) % width) == 0 && (i + 1) < data.length) str += "\r\n"
    }
    return str;
}

function imageToAscii(
    data: Uint8ClampedArray,
    width: number,
    height: number
) : string {
    if (data.length != width * height * 4) {
        console.error("Dimension mismatch");
        return;
    }

    console.debug("Converting image...");

    console.debug("Converting to black and white");
    const bw = colorToBW(data, width, height);

    console.debug("Smoothing black and white");
    const smoothed = kernel(bw, width, height, 
        config.gaussianKernel.kernel, config.gaussianKernel.size);

    console.debug("Calculating sobel");
    const sobelx = kernel(smoothed, width, height, [1, 0, -1, 2, 0, -2, 1, 0, -1], 3);
    const sobely = kernel(smoothed, width, height, [1, 2, 1, 0, 0, 0, -1, -2, -1], 3);

    console.debug("Calculating gradient magnitude and direction")
    const gradientmag = new Int32Array(width * height);
    const gradientdir = new Int32Array(width * height);
    let lowest = 255, highest = 0;

    for (let i = 0; i < gradientmag.length; i++) {
        const mag = Math.sqrt(
            sobelx[i] * sobelx[i] +
            sobely[i] * sobely[i]
        );
        const x = i % width;
        const y = Math.floor(i / width);
        if (!(x == 0 || x == width - 1 || y == 0 || y == height - 1)) {
            // Ignore the image edges from detection
            lowest = Math.min(lowest, mag)
            highest = Math.max(highest, mag)
        }
        gradientmag[i] = mag
        gradientdir[i] = Math.atan2(sobely[i], sobelx[i]) * 180 / Math.PI
    }

    console.debug("Normalizing gradient magnitude")
    for (let i = 0; i < gradientmag.length; i++) {
        let val = (gradientmag[i] - lowest) * 255. / (highest - lowest);
        gradientmag[i] = val;
    }

    console.debug("Suppressing intermediate values")
    const supressed = new Uint8Array(width * height);
    const f = (x, y) => x + y * width;

    const HIGH_VALUE = config.doubleThreshold.highValue;
    const LOW_VALUE = config.doubleThreshold.lowValue
    const HIGH_THRESHOLD = config.doubleThreshold.highThreshold
    const LOW_THRESHOLD = config.doubleThreshold.lowThreshold
    const BORDER_SIZE = config.borderSize
    
    for (let i = 0; i < gradientmag.length; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        // Remove the edges
        if (x <= BORDER_SIZE || x >= width - 1 - BORDER_SIZE || y <= BORDER_SIZE || y >= height - 1 - BORDER_SIZE) {
            supressed[i] = 0;
        } else {
            const angle = gradientdir[i];
            const aangle = Math.abs(angle);
            let val = gradientmag[i]
            if (aangle < 30) {
                // East-West pixels
                if (gradientmag[f(x - 1, y)] > val || gradientmag[f(x + 1, y)] > val) val = 0;
            }
            else if (aangle < 60) {
                // Corners
                if (angle < 0) {
                    if (gradientmag[f(x - 1, y - 1)] > val || gradientmag[f(x + 1, y + 1)] > val) val = 0;
                }
                else {
                    if (gradientmag[f(x + 1, y - 1)] > val || gradientmag[f(x - 1, y + 1)] > val) val = 0;
                }
            }
            else {
                // North-South pixels
                if (gradientmag[f(x, y - 1)] > val || gradientmag[f(x, y + 1)] > val) val = 0;
            }
            // Double thresholding
            if (val < LOW_THRESHOLD) supressed[i] = 0;
            else if (val > HIGH_THRESHOLD) supressed[i] = HIGH_VALUE;
            else supressed[i] = LOW_VALUE;
        }
    }

    console.debug("Performing hysteresis")
    const edges = new Uint8Array(width * height);
    const fringe = Array();
    // Find all the strong pixels and add them to the stack
    for (let i = 0; i < gradientmag.length; i++) {
        if (supressed[i] == HIGH_VALUE) {
            const x = i % width;
            const y = Math.floor(i / width);
            fringe.push([x, y, i]);
            edges[i] = HIGH_VALUE;
        }
    }
    // Now, on the fringe, explore for low values and add them as well
    while (fringe.length > 0) {
        const current = fringe.pop();
        const x = current[0];
        const y = current[1];
        // Investigate the adjacent values
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0) continue;
                const itx = f(x + dx, y + dy);
                if (supressed[itx] == LOW_VALUE) {
                    supressed[itx] = HIGH_VALUE;
                    fringe.push([x + dx, y + dy, itx]);
                    edges[itx] = HIGH_VALUE;
                }
            }
        }
    }

    console.debug("Combining image elements")
    const combined = new Uint8ClampedArray(width * height)
    for (let i = 0; i < combined.length; i++) {
        const calc = 
            (255 - edges[i]) * config.edgeInfluence +
            (255 - supressed[i]) * config.suppressedInfluence +
            bw[i] * config.bwInfluence
        // No need to clamp the value; data structure does it automatically
        combined[i] = calc
    }

    console.debug("Downscaling")
    var [wout, hout] = getOutputTextSize()
    const final = downscale(combined, width, height, wout, hout);

    console.debug("Converting to ascii characters")
    const output = valuesToAscii(final, wout)
    
    return output;
}

function drawAndConvert(toDisplay : CanvasImageSource) : void {
    let cv = document.createElement('canvas');
    cv.height = 300;
    cv.width = cv.height * config.ratios.video;
    // $('body').append(cv);

    let ctx = cv.getContext('2d');
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(toDisplay, 0, 0, cv.width, cv.height);

    let frame = ctx.getImageData(0, 0, cv.width, cv.height);
    let data = frame.data;

    let out = imageToAscii(data, frame.width, frame.height);

    let cv2 = document.createElement('canvas');
    let [cvw, cvh] = getOutputImageSize()
    cv2.height = cvh;
    cv2.width = cvw;
    $('body').append(cv2);
    let c = cv2.getContext('2d');
    // const fontSize = config.fontSize
    // c.font = fontSize + "px Courier New";
    c.font = config.fontString()
    c.textBaseline = "bottom"
    const rows = out.split("\r\n")
    for (let i = 0; i < rows.length; i++) {
        c.fillText(rows[i], 0, config.fontSize * (i + 1));
    }
    // c.fillText(out, 0, fontSize * config.outputHeight)
    // c.fillText("Hello!", 48, 48)
}

$(function() {
    let video : HTMLVideoElement = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.style.width = config.srcVideoWidth;
    video.style.height = config.srcVideoHeight;

    // We want the front-facing camera
    var facingMode = "user"; // Can be 'user' or 'environment' to access back or front camera (NEAT!)

    var constraints = {
        audio: false,
        video: {
            facingMode: facingMode
        }
    };
    navigator.mediaDevices.getUserMedia(constraints).then(function success(stream) {
        video.srcObject = stream;
    });

    $('body').append(video)

    setTimeout(() => drawAndConvert(video), 1500)

    // Image submission!
    let inp = $('<input type="file" accept="image/jpeg, image/png, image/jpg">')[0] as HTMLInputElement;
    $('body').append(inp)
    inp.addEventListener("change", function () {
        const files = inp.files;
        const file = files[0]
        console.log("Displaying " + file.name)

        // Create an image object
        const img = document.createElement("img")
        img.src = URL.createObjectURL(file)
        img.style.display = "none"
        $('body').append(img)

        setTimeout(() => drawAndConvert(img), 10);
    })
})
