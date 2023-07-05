function plsprint(msg) {
    console.log(msg);
}
var message = "Hello, world!";
$(function () {
    // plsprint(message)
});
// 
function colorToBW(data, width, height) {
    if (data.length != 4 * width * height) {
        console.error("Dimension mismatch");
        return;
    }
    var output = new Int32Array(width * height);
    for (var i = 0; i < output.length; i++) {
        var itx = i * 4;
        var red = data[itx + 0];
        var green = data[itx + 1];
        var blue = data[itx + 2];
        // Taken from online research
        output[i] = red * 0.299 + green * 0.587 + blue * 0.114;
    }
    return output;
}
function kernel(data, width, height, kernel, kernel_size) {
    if (data.length != width * height) {
        console.error("Dimension mismatch");
        return;
    }
    if (kernel.length != kernel_size * kernel_size) {
        console.error("Kernel dimension mismatch");
        return;
    }
    var output = new Int32Array(width * height);
    var lhalf = Math.floor(kernel_size / 2);
    var half = Math.ceil(kernel_size / 2);
    for (var i = 0; i < output.length; i++) {
        var result = 0;
        var current_x = i % width;
        var current_y = Math.floor(i / width);
        for (var dx = -lhalf; dx < half; dx++) {
            for (var dy = -lhalf; dy < half; dy++) {
                var calc_x = current_x + dx;
                var calc_y = current_y + dy;
                // Check in bounds
                if (calc_x < 0 || calc_x >= width || calc_y < 0 || calc_y >= height)
                    continue;
                var kernel_index = dx + lhalf + (dy + lhalf) * kernel_size;
                var kernel_value = kernel[kernel_index];
                var data_value = data[calc_x + width * calc_y];
                result += kernel_value * data_value;
            }
        }
        output[i] = result;
    }
    return output;
}
function linearCombination(dataSrcs, influences) {
    var output = new Int32Array(dataSrcs[0].length);
    for (var i = 0; i < dataSrcs[0].length; i++) {
        var value = 0;
        for (var src_index = 0; src_index < dataSrcs.length; src_index++) {
            value += dataSrcs[src_index][i] * influences[i];
        }
        output[i] = value;
    }
    return output;
}
function downscale(data, width, height, desired_width, desired_height) {
    var output = new Int32Array(desired_width * desired_height);
    var pixel_count = new Int32Array(desired_width * desired_height);
    for (var i = 0; i < data.length; i++) {
        var x = i % width;
        var y = Math.floor(i / width);
        var dx = Math.floor(x / width * desired_width);
        var dy = Math.floor(y / height * desired_height);
        var destination_index = dy * desired_width + dx;
        output[destination_index] += data[i];
        pixel_count[destination_index] += 1;
    }
    // Average them out
    for (var i = 0; i < data.length; i++) {
        output[i] = output[i] / pixel_count[i];
    }
    return output;
}
var currentPage;
function highlightCurrentTab() {
    var activeClassName = "tab-active";
    // Remove the class from everyone from everyone.
    $(".tab").removeClass(activeClassName);
    // Use the current page to decide who 
    // to give it back to.
    var searching = ".tab-" + currentPage;
    $(searching).addClass(activeClassName);
}
function showPageContent() {
    var activeClassName = "section-active";
    // Remove the class from everyone from everyone.
    $(".section").removeClass(activeClassName);
    // Use the current page to decide who 
    // to give it back to.
    var searching = ".section-" + currentPage;
    $(searching).addClass(activeClassName);
}
function switchToSelectedPage() {
    highlightCurrentTab();
    showPageContent();
}
function switchToPage(page) {
    currentPage = page;
    switchToSelectedPage();
}
function initNavigation() {
    console.debug("Navigation setup");
    switchToPage("about");
    // Get when a tab is clicked
    $(".tab").on("click", function (e) {
        var classes = e.target.classList;
        if (classes.contains("tab-about"))
            currentPage = "about";
        if (classes.contains("tab-select"))
            currentPage = "select";
        if (classes.contains("tab-view"))
            currentPage = "view";
        if (classes.contains("tab-advanced"))
            currentPage = "advanced";
        switchToSelectedPage();
    });
    $(".switch-to-select").on("click", function () { return switchToPage("select"); });
}
/// <reference path="imagemanip.ts" />
/// <reference path="navigation.ts" />
var lastDisplay;
var config = {
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
    desiredOutputLines: 120,
    ratios: {
        video: 4 / 3,
    },
    fontString: function () {
        return this.fontSize + "px " + this.fontName;
    }
};
function calculateTextRatio() {
    var canv = document.createElement("canvas");
    var cont = canv.getContext("2d");
    cont.font = config.fontString();
    var metrics = cont.measureText("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    return metrics.width / 26 / config.fontSize;
}
function getOutputTextSize() {
    var height = config.desiredOutputLines;
    var width = Math.floor(height * config.ratios.video / calculateTextRatio());
    return [width, height];
}
function getOutputImageSize() {
    var _a = getOutputTextSize(), tw = _a[0], th = _a[1];
    var width = tw * config.fontSize * calculateTextRatio();
    var height = th * config.fontSize;
    return [width, height];
}
function valuesToAscii(data, width, range) {
    if (range === void 0) { range = 255; }
    var str = "";
    for (var i = 0; i < data.length; i++) {
        var val = data[i];
        var index = void 0;
        if (val == 0)
            index = 0;
        else
            index = config.asciiCharacters.length -
                Math.ceil(val / range * config.asciiCharacters.length);
        str += config.asciiCharacters[index];
        if (((i + 1) % width) == 0 && (i + 1) < data.length)
            str += "\r\n";
    }
    return str;
}
function imageToAscii(data, width, height) {
    if (data.length != width * height * 4) {
        console.error("Dimension mismatch");
        return;
    }
    console.debug("Converting image...");
    console.debug("Converting to black and white");
    var bw = colorToBW(data, width, height);
    console.debug("Smoothing black and white");
    var smoothed = kernel(bw, width, height, config.gaussianKernel.kernel, config.gaussianKernel.size);
    console.debug("Calculating sobel");
    var sobelx = kernel(smoothed, width, height, [1, 0, -1, 2, 0, -2, 1, 0, -1], 3);
    var sobely = kernel(smoothed, width, height, [1, 2, 1, 0, 0, 0, -1, -2, -1], 3);
    console.debug("Calculating gradient magnitude and direction");
    var gradientmag = new Int32Array(width * height);
    var gradientdir = new Int32Array(width * height);
    var lowest = 255, highest = 0;
    for (var i = 0; i < gradientmag.length; i++) {
        var mag = Math.sqrt(sobelx[i] * sobelx[i] +
            sobely[i] * sobely[i]);
        var x = i % width;
        var y = Math.floor(i / width);
        if (!(x == 0 || x == width - 1 || y == 0 || y == height - 1)) {
            // Ignore the image edges from detection
            lowest = Math.min(lowest, mag);
            highest = Math.max(highest, mag);
        }
        gradientmag[i] = mag;
        gradientdir[i] = Math.atan2(sobely[i], sobelx[i]) * 180 / Math.PI;
    }
    console.debug("Normalizing gradient magnitude");
    for (var i = 0; i < gradientmag.length; i++) {
        var val = (gradientmag[i] - lowest) * 255. / (highest - lowest);
        gradientmag[i] = val;
    }
    console.debug("Suppressing intermediate values");
    var supressed = new Uint8Array(width * height);
    var f = function (x, y) { return x + y * width; };
    var HIGH_VALUE = config.doubleThreshold.highValue;
    var LOW_VALUE = config.doubleThreshold.lowValue;
    var HIGH_THRESHOLD = config.doubleThreshold.highThreshold;
    var LOW_THRESHOLD = config.doubleThreshold.lowThreshold;
    var BORDER_SIZE = config.borderSize;
    for (var i = 0; i < gradientmag.length; i++) {
        var x = i % width;
        var y = Math.floor(i / width);
        // Remove the edges
        if (x <= BORDER_SIZE || x >= width - 1 - BORDER_SIZE || y <= BORDER_SIZE || y >= height - 1 - BORDER_SIZE) {
            supressed[i] = 0;
        }
        else {
            var angle = gradientdir[i];
            var aangle = Math.abs(angle);
            var val = gradientmag[i];
            if (aangle < 30) {
                // East-West pixels
                if (gradientmag[f(x - 1, y)] > val || gradientmag[f(x + 1, y)] > val)
                    val = 0;
            }
            else if (aangle < 60) {
                // Corners
                if (angle < 0) {
                    if (gradientmag[f(x - 1, y - 1)] > val || gradientmag[f(x + 1, y + 1)] > val)
                        val = 0;
                }
                else {
                    if (gradientmag[f(x + 1, y - 1)] > val || gradientmag[f(x - 1, y + 1)] > val)
                        val = 0;
                }
            }
            else {
                // North-South pixels
                if (gradientmag[f(x, y - 1)] > val || gradientmag[f(x, y + 1)] > val)
                    val = 0;
            }
            // Double thresholding
            if (val < LOW_THRESHOLD)
                supressed[i] = 0;
            else if (val > HIGH_THRESHOLD)
                supressed[i] = HIGH_VALUE;
            else
                supressed[i] = LOW_VALUE;
        }
    }
    console.debug("Performing hysteresis");
    var edges = new Uint8Array(width * height);
    var fringe = Array();
    // Find all the strong pixels and add them to the stack
    for (var i = 0; i < gradientmag.length; i++) {
        if (supressed[i] == HIGH_VALUE) {
            var x = i % width;
            var y = Math.floor(i / width);
            fringe.push([x, y, i]);
            edges[i] = HIGH_VALUE;
        }
    }
    // Now, on the fringe, explore for low values and add them as well
    while (fringe.length > 0) {
        var current = fringe.pop();
        var x = current[0];
        var y = current[1];
        // Investigate the adjacent values
        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                if (dx == 0 && dy == 0)
                    continue;
                var itx = f(x + dx, y + dy);
                if (supressed[itx] == LOW_VALUE) {
                    supressed[itx] = HIGH_VALUE;
                    fringe.push([x + dx, y + dy, itx]);
                    edges[itx] = HIGH_VALUE;
                }
            }
        }
    }
    console.debug("Combining image elements");
    var combined = new Uint8ClampedArray(width * height);
    for (var i = 0; i < combined.length; i++) {
        var calc = (255 - edges[i]) * config.edgeInfluence +
            (255 - supressed[i]) * config.suppressedInfluence +
            bw[i] * config.bwInfluence;
        // No need to clamp the value; data structure does it automatically
        combined[i] = calc;
    }
    console.debug("Downscaling");
    var _a = getOutputTextSize(), wout = _a[0], hout = _a[1];
    var final = downscale(combined, width, height, wout, hout);
    console.debug("Converting to ascii characters");
    var output = valuesToAscii(final, wout);
    return output;
}
function drawAndConvert(toDisplay, dest) {
    // Remove existing outputs, if they exist
    var destel = $(dest);
    destel.children().remove();
    console.debug('Drawing to', destel);
    var cv = document.createElement('canvas');
    cv.height = 300;
    cv.width = cv.height * config.ratios.video;
    // $('body').append(cv);
    var ctx = cv.getContext('2d');
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(toDisplay, 0, 0, cv.width, cv.height);
    lastDisplay = toDisplay;
    var frame = ctx.getImageData(0, 0, cv.width, cv.height);
    var data = frame.data;
    var out = imageToAscii(data, frame.width, frame.height);
    // Let's set the last output for retrieval later
    localStorage.setItem("last output", out);
    var cv2 = document.createElement('canvas');
    var _a = getOutputImageSize(), cvw = _a[0], cvh = _a[1];
    cv2.height = cvh;
    cv2.width = cvw;
    destel.append(cv2);
    var c = cv2.getContext('2d');
    c.fillStyle = "white";
    c.fillRect(0, 0, cv2.width, cv2.height);
    c.fillStyle = "black";
    c.font = config.fontString();
    c.textBaseline = "bottom";
    var rows = out.split("\r\n");
    for (var i = 0; i < rows.length; i++) {
        c.fillText(rows[i], 0, config.fontSize * (i + 1));
    }
    // c.fillText(out, 0, fontSize * config.outputHeight)
    // c.fillText("Hello!", 48, 48)
    $(".before").hide();
    $(".after-controls").show();
}
function showAlert(message) {
    alert(message);
}
function rerenderAdvanced() {
    if (lastDisplay == null) {
        showAlert("You need to take or upload a picture first");
        return;
    }
    drawAndConvert(lastDisplay, '.advanced-output-container');
}
// function addSlider(low : number, high : number, defaultValue : number, label : string, target : any) {
//     const labelEl = document.createElement("div")
//     labelEl.innerText = label
//     $('.left').prepend(labelEl)
//     target = low
// }
$(function () {
    var video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.style.width = config.srcVideoWidth;
    // video.style.height = config.srcVideoHeight;
    video.style.height = "auto";
    // We want the front-facing camera
    var facingMode = "user"; // Can be 'user' or 'environment' to access back or front camera (NEAT!)
    var constraints = {
        audio: false,
        video: {
            facingMode: facingMode
        }
    };
    // setTimeout(() => drawAndConvert(video), 1500)
    // Image submission!
    $(".upload").on("change", function (e) {
        var el = e.target;
        var files = el.files;
        var file = files[0];
        console.debug("Displaying " + file.name);
        // Create an image object
        var img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.display = "none";
        $('body').append(img);
        setTimeout(function () {
            drawAndConvert(img, '.output-container');
            switchToPage("view");
        }, 10);
    });
    // Hide the camera controls until the video is enabled
    $(".video-view").children().hide();
    function enableVideo() {
        navigator.mediaDevices.getUserMedia(constraints).then(function success(stream) {
            video.srcObject = stream;
            // Show the video controls
            $(".video-view").children().show();
            // Add the video to the display, remove the button
            $(".video-view").prepend(video);
            $(".enable-video").parent().hide();
        });
    }
    // Request for video!
    $(".enable-video").on("click", enableVideo);
    // Take the photo
    $(".capture").on("click", function () {
        switchToPage("view");
        drawAndConvert(video, '.output-container');
    });
    // addSlider(1, 120, 120, 'Text output lines', config.desiredOutputLines)
    // Hide the after controls by default
    $(".after-controls").hide();
    // $(".before").hide();
    initNavigation();
    // $(".advanced-output-container").append(document.createElement("canvas"))
    // enableVideo()
    // setTimeout(function() {
    //     drawAndConvert(video, '.advanced-output-container')
    //     switchToPage('advanced')
    // }, 2000)
    // $(".advanced-render-btn").on("click", rerenderAdvanced)
});
