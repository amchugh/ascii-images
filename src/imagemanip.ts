

function colorToBW(
    data: Uint8ClampedArray, 
    width: number, 
    height: number
) : Int32Array {
    if (data.length != 4 * width * height) {
        console.error("Dimension mismatch")
        return;
    }

    const output = new Int32Array(width * height)
    for (let i = 0; i < output.length; i++) {
        const itx = i * 4;
        const red = data[itx + 0];
        const green = data[itx + 1];
        const blue = data[itx + 2];
        // Taken from online research
        output[i] = red * 0.299 + green * 0.587 + blue * 0.114;
    }
    return output;
}

function kernel(
    data: Int32Array,
    width: number,
    height: number,
    kernel: number[],
    kernel_size: number
) : Int32Array {
    if (data.length != width * height) {
        console.error("Dimension mismatch")
        return;
    }
    if (kernel.length != kernel_size * kernel_size) {
        console.error("Kernel dimension mismatch")
        return;
    }

    const output = new Int32Array(width * height)

    let lhalf = Math.floor(kernel_size / 2)
    let half = Math.ceil(kernel_size / 2)

    for (let i = 0; i < output.length; i++) {
        let result = 0;
        const current_x = i % width;
        const current_y = Math.floor(i / width);
        for (let dx = -lhalf; dx < half; dx++) {
            for (let dy = -lhalf; dy < half; dy++) {
                const calc_x = current_x + dx;
                const calc_y = current_y + dy;
                // Check in bounds
                if (calc_x < 0 || calc_x >= width || calc_y < 0 || calc_y >= height) continue;
                const kernel_index = dx + lhalf + (dy + lhalf) * kernel_size;
                const kernel_value = kernel[kernel_index]
                const data_value = data[calc_x + width * calc_y];
                result += kernel_value * data_value;
            }
        }
        output[i] = result;
    }

    return output;
}

function linearCombination(
    dataSrcs: Int32Array[],
    influences: number[]
) : Int32Array {
    const output = new Int32Array(dataSrcs[0].length);

    for (let i = 0; i < dataSrcs[0].length; i++) {
        let value = 0;
        for (let src_index = 0; src_index < dataSrcs.length; src_index++) {
            value += dataSrcs[src_index][i] * influences[i];
        } 
        output[i] = value;
    }

    return output;
}

function downscale(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    desired_width: number,
    desired_height: number
) : Int32Array {
    const output = new Int32Array(desired_width * desired_height);
    const pixel_count = new Int32Array(desired_width * desired_height);

    for (let i = 0; i < data.length; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        const dx = Math.floor(x / width * desired_width);
        const dy = Math.floor(y / height * desired_height);
        const destination_index = dy * desired_width + dx;
        output[destination_index] += data[i];
        pixel_count[destination_index] += 1
    }

    // Average them out
    for (let i = 0; i < data.length; i++) {
        output[i] = output[i] / pixel_count[i];
    }

    return output;
}
