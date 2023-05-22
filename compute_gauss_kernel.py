
# https://stackoverflow.com/questions/29731726/how-to-calculate-a-gaussian-kernel-matrix-efficiently-in-numpy
import numpy as np
def gkern(l=5, sig=1.):
    """\
    creates gaussian kernel with side length `l` and a sigma of `sig`
    """
    ax = np.linspace(-(l - 1) / 2., (l - 1) / 2., l)
    gauss = np.exp(-0.5 * np.square(ax) / np.square(sig))
    kernel = np.outer(gauss, gauss)
    return kernel / np.sum(kernel), kernel, np.sum(kernel)

if __name__ == "__main__":
    size = int(input("What is the size of the matrix: "))
    sigma = input("What is the matrix sigma: ")
    try:
        sigma = float(sigma)
    except:
        sigma = 0.84089642

    m, _, denom = gkern(size, sigma)
    print(f"Size: {size}  Sigma: {sigma}")
    print(f"Denominator: {denom}")
    vals = []
    for i in m:
        for val in i:
            vals.append(str(float(val)))
    print("[", ",".join(vals), "]", sep='')
