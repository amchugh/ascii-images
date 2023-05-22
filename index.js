
var cv;
var ctx;

var dstcv;
var dstctx;

var textdst;

var outputData;

const CHARACTERS = [' ', '.', ',', '!', '*', 'o', 'O', '8', '#', '@']

// Control sliders
var highValueSlider;
var lowValueSlider;

var doNormalizeFinalBox;

function colorToBW(data, width, height) {
    const output = Array(width * height)
    for (let i = 0; i < output.length; i++) {
        const itx = i * 4;
        const red = data[itx + 0];
        const green = data[itx + 1];
        const blue = data[itx + 2];
        output[i] = red * 0.299 + green * 0.587 + blue * 0.114;
    }
    return output;
}

function kernel(data, width, height, kernel, kernel_size) {
    const output = new Int32Array(width * height)

    let lhalf = Math.floor(kernel_size / 2)
    let half = Math.ceil(kernel_size / 2)

    for (let i = 0; i < output.length; i++) {
        let result = 0;
        const x = i % width;
        const y = Math.floor(i / width);
        for (let dx = -lhalf; dx < half; dx++) {
            for (let dy = -lhalf; dy < half; dy++) {
                const ox = x + dx;
                const oy = y + dy;
                if (ox < 0 || ox >= width || oy < 0 || oy >= height) continue;
                const ki = dx + lhalf + (dy + lhalf) * kernel_size;
                const kernel_value = kernel[ki]
                const data_value = data[ox + width * oy];
                result += kernel_value * data_value;
            }
        }
        // Need to clamp our values!!
        // output[i] = Math.max(Math.min(result, 255), 0);
        // Unclamped for now
        output[i] = result;
    }

    return output;
}

function imageToAscii(data, width, range = 255) {
    let str = ""
    for (let i = 0; i < data.length; i++) {
        let val = data[i];
        let index;
        if (val == 0) index = 0;
        else index = CHARACTERS.length - Math.ceil(val / range * CHARACTERS.length);
        str += CHARACTERS[index];
        if (((i + 1) % width) == 0 && (i + 1) < data.length) str += "\r\n"
    }
    return str;
}

function downscale(data, width) {
    const output = new Uint8Array(data.length / 4);
    const new_width = width / 2
    const f = (x, y) => x + y * width;
    for (let i = 0; i < output.length; i++) {
        let result = 0;
        const x = i % new_width;
        const y = Math.floor(i / new_width);
        result = data[f(x * 2, y * 2)] +
            data[f(x * 2 + 1, y * 2)] +
            data[f(x * 2, y * 2 + 1)] +
            data[f(x * 2 + 1, y * 2 + 1)];
        output[i] = result / 4;
    }
    console.log(new_width, data[f(100, 100)], output[50 + 50 * new_width])
    return output;
}

function convert() {
    // Get the raw frame data
    const frame = ctx.getImageData(0, 0, cv.width, cv.height);
    const data = frame.data;

    var w = frame.width
    var h = frame.height

    // Make the frame black and white
    const bw = colorToBW(data, w, h);

    // Downscale to remove some noise
    // const ds = downscale(bw, w);
    // w = w / 2;
    // h = h / 2;

    // First, let's smooth the image using a gaussian approximation
    const gausskernel = [2, 4, 5, 4, 2, 4, 9, 12, 9, 4, 5, 12, 15, 12, 5, 4, 9, 12, 4, 9, 2, 4, 5, 4, 2]
    for (let i = 0; i < gausskernel.length; i++) gausskernel[i] /= 159.0;
    // const gausskernel = [
    //     1, 4, 7, 4, 1,
    //     4, 16, 26, 16, 4,
    //     7, 26, 41, 26, 7,
    //     4, 16, 26, 16, 4,
    //     1, 4, 7, 4, 1]
    // for (let i = 0; i < gausskernel.length; i++) gausskernel[i] /= 273.0;

    // const gausskernel = [6.962478188799075e-08, 2.8088641754266942e-05, 0.00020754854966504427, 2.8088641754266942e-05, 6.962478188799075e-08, 2.8088641754266942e-05, 0.011331766853773576, 0.08373106098253583, 0.011331766853773576, 2.8088641754266942e-05, 0.00020754854966504427, 0.08373106098253583, 0.6186935068229404, 0.08373106098253583, 0.00020754854966504427, 2.8088641754266942e-05, 0.011331766853773576, 0.08373106098253583, 0.011331766853773576, 2.8088641754266942e-05, 6.962478188799075e-08, 2.8088641754266942e-05, 0.00020754854966504427, 2.8088641754266942e-05, 6.962478188799075e-08]
    const smoothed = kernel(bw, w, h, gausskernel, 5)

    // Need sobel in both directions
    const sobelx = kernel(smoothed, w, h, [1, 0, -1, 2, 0, -2, 1, 0, -1], 3)
    const sobely = kernel(smoothed, w, h, [1, 2, 1, 0, 0, 0, -1, -2, -1], 3)

    // Combine them to get gradient magnitude
    const gradientmag = new Int32Array(w * h);
    const gradientdir = new Int32Array(w * h);

    let lowest = 255, highest = 0;

    for (let i = 0; i < gradientmag.length; i++) {
        const mag = Math.sqrt(
            sobelx[i] * sobelx[i] +
            sobely[i] * sobely[i]
        );
        const x = i % w;
        const y = Math.floor(i / w);
        if (!(x == 0 || x == w - 1 || y == 0 || y == h - 1)) {
            // Ignore the image edges from detection
            lowest = Math.min(lowest, mag)
            highest = Math.max(highest, mag)
        }
        gradientmag[i] = mag
        gradientdir[i] = Math.atan2(sobely[i], sobelx[i]) * 180 / Math.PI
    }

    // Now we can normalize the gradient magnitude
    for (let i = 0; i < gradientmag.length; i++) {
        let val = (gradientmag[i] - lowest) * 255. / (highest - lowest);
        gradientmag[i] = val;
    }

    // Time to supress intermediary values
    const supressed = new Uint8Array(w * h);
    const f = (x, y) => x + y * w;
    // const HIGH_VALUE = $("#strong-slider").val();
    // const LOW_VALUE = $("#weak-slider").val();
    const HIGH_VALUE = highValueSlider.val();
    const LOW_VALUE = lowValueSlider.val();
    const HIGH_THRESHOLD = highThresholdSlider.val();
    const LOW_THRESHOLD = lowThresholdSlider.val();
    // console.debug("Using values " + HIGH_VALUE + ", " + LOW_VALUE)
    const EDGE_SIZE = edgeSizeSlider.val();
    for (let i = 0; i < gradientmag.length; i++) {
        const x = i % w;
        const y = Math.floor(i / w);
        // Remove the edges
        if (x <= EDGE_SIZE || x >= w - 1 - EDGE_SIZE || y <= EDGE_SIZE || y >= h - 1 - EDGE_SIZE) {
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

    // Hysterersis
    const edges = new Uint8Array(w * h);
    const fringe = Array();
    // Find all the strong pixels and add them to the stack
    for (let i = 0; i < gradientmag.length; i++) {
        if (supressed[i] == HIGH_VALUE) {
            const x = i % w;
            const y = Math.floor(i / w);
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

    // const [smoothed, w, h] = kernel(bw, frame.width, frame.height, [1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9], 3)
    // const [smoothed, w, h] = kernel(bw, frame.width, frame.height, [.9], 1)

    // Box them
    const bwW = bwFactor.val()
    const eW = edgeFactor.val()
    let arr = Array(textdst.rows * textdst.cols)
    let counts = Array(textdst.rows * textdst.cols)
    for (let i = 0; i < arr.length; i++) { arr[i] = 0; counts[i] = 0; }
    for (let i = 0; i < bw.length; i++) {
        const x = i % frame.width;
        const y = Math.floor(i / frame.width)
        const dx = Math.floor(x / frame.width * textdst.cols);
        const dy = Math.floor(y / frame.height * textdst.rows);
        const dsti = dy * textdst.cols + dx
        arr[dsti] += Math.min(bw[i] * bwW + (255 - supressed[i]) * eW, 255)
        counts[dsti] += 1
    }

    for (let i = 0; i < arr.length; i++) {
        arr[i] = arr[i] / counts[i];
    }

    if (doNormalizeFinalBox.is(":checked")) {
        // Scale the values?
        let amin = 255;
        let amax = 0;
        for (let i = 0; i < arr.length; i++) {
            let val = arr[i];
            amax = Math.max(val, amax);
            amin = Math.min(val, amin)
        }
        for (let i = 0; i < arr.length; i++) {
            arr[i] = (arr[i] - amin) / (amax - amin) * 255
        }
    }

    textdst.value = imageToAscii(arr, textdst.cols);

    // Update the data so we can see the partial
    let o = supressed
    for (let i = 0; i < o.length; i++) {
        // Need to clamp our values!!
        let val = 0;
        if (o[i] == HIGH_VALUE) val = 255
        else if (o[i] == LOW_VALUE) val = 127
        // let val = Math.max(Math.min(o[i], 255), 0);
        data[i * 4 + 0] = val
        data[i * 4 + 1] = val / 2.
        data[i * 4 + 2] = val / 3.
    }

    dstctx.putImageData(frame, 0, 0)
}

var drawHandle;
var video;

function startDraw() {
    if (drawHandle) {
        console.error("Video already started!");
        return;
    }
    drawHandle = setInterval(function () {
        ctx.drawImage(video, 0, 0, cv.width, cv.height);
    }, 20);
}
function stopDraw() {
    if (!drawHandle) {
        console.error("Video not started!");
        return;
    }
    clearInterval(drawHandle);
    drawHandle = null;
}

$(function () {
    video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.style.width = '200px';
    video.style.height = '200px';

    /* Setting up the constraint */
    var facingMode = "user"; // Can be 'user' or 'environment' to access back or front camera (NEAT!)
    var constraints = {
        audio: false,
        video: {
            facingMode: facingMode
        }
    };

    /* Stream it to video element */
    navigator.mediaDevices.getUserMedia(constraints).then(function success(stream) {
        video.srcObject = stream;
    });

    // let el = document.getElementById("#videoContainer")
    // $("#videoContainer")[0].appendChild(video)

    cv = $("#display")[0]
    cv.width = 400 * 2
    cv.height = 300 * 2
    ctx = cv.getContext('2d');
    ctx.translate(cv.width, 0)
    ctx.scale(-1, 1)

    {
        let container = $('<div></div>')

        let vtoggle = $('<input type="checkbox">')
        vtoggle.on("change", () => {
            cv.hidden = !vtoggle.is(':checked');
            if (cv.hidden) convert();
        })
        cv.hidden = !vtoggle.is(':checked');

        container.append($("<span></span>").text("Toggle video visibility: "))
        container.append(vtoggle)
        $("#controls").append(container)
    }

    startDraw();
    $('#freeze').click(stopDraw)
    $('#go').click(startDraw)

    let btn = $('#clickme')
    btn.click(convert)
    // btn.hide()
    // btn.style = "display:none;"

    // setInterval(function () {
    //     convert()
    // }, 100)
    // setTimeout(function () {
    //     convert()
    // }, 1000)

    dstcv = $("#destination")[0]
    if (dstcv) {
        dstcv.width = cv.width
        dstcv.height = cv.height
        dstctx = dstcv.getContext('2d');
    }

    dstcv.hidden = true;

    let d = $('.destination')[0]
    // d.cols = 47
    // d.rows = 20
    let size = 100 * 2.5
    // let ratio = 0.4255
    let ratio = 0.39
    d.cols = size
    d.rows = size * ratio
    console.log("Displaying " + d.cols + "x" + d.rows)
    textdst = d

    // Create all the controls:
    function addToggle(label, defaultValue = true) {
        let container = $("<div></div>");

        let _label = $("<span></span>")
        _label.text(label)

        let box;
        if (defaultValue) box = $('<input type="checkbox" checked>')
        else box = $('<input type="checkbox">')
        box.on("change", () => convert())

        container.append(_label)
        container.append(box)

        $("#controls").append(container)
        return box
    }

    function addControl(label, defaultValue = 100, minV = 0, maxV = 255, interval = 1) {
        let container = $("<div></div>");

        let _label = $("<span></span>")
        _label.text(label)

        let slider = $('<input type="range" max="' + maxV + '" min="' + minV + '" step="' + interval + '">');
        slider.val(defaultValue)
        slider.addClass("slider")

        let display = $('<span></span>');
        display.text(slider.val())
        slider.on("input", () => {
            display.text(slider.val());
        })
        slider.on("change", () => convert())

        container.append(_label)
        container.append(slider)
        container.append(display)

        $("#controls").append(container)
        return slider
    }

    doNormalizeFinalBox = addToggle("Normalize final image")

    highThresholdSlider = addControl("High threshold", 75)
    lowThresholdSlider = addControl("Low threshold", 17)
    highValueSlider = addControl("High value", 76)
    lowValueSlider = addControl("Low value", 23)
    edgeSizeSlider = addControl("Edge Size", 2, 0, 10)

    bwFactor = addControl("Black and White weight", 0.7, 0, 3, 0.05)
    edgeFactor = addControl("Edge weight", 0.3, 0, 1.2, 0.05)

})
