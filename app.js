const {ImagePool} = require('@squoosh/lib');
const fs = require('fs');
const path = require('path');
const {cpus} = require('os');

const ORIGINAL_FOLDER = './original/';
const SQUOOSHED_FOLDER = './squooshed/';
const IS_RESIZING_ENABLED = true;
const IS_CHANGING_EXTENSION_ENABLED = true;

const imagePool = new ImagePool(cpus().length);

const cleanSquooshedFolder = () => {
    fs.rmSync(SQUOOSHED_FOLDER, {recursive: true});
    fs.mkdirSync(SQUOOSHED_FOLDER, {recursive: true});
};

const generateFilenames = (currentDirectory) => {
    const files = [];

    fs.readdirSync(currentDirectory).forEach((file) => {
        const filePath = path.join(currentDirectory, file);

        if (fs.lstatSync(filePath).isDirectory()) files.push(...generateFilenames(filePath));
        else files.push(filePath);
    });

    return files;
};

const squooshImage = async (filename) => {
    const originalFilePath = ORIGINAL_FOLDER + filename;

    const fileData = await new Promise((resolve, reject) => {
        fs.readFile(originalFilePath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });

    const image = imagePool.ingestImage(fileData);

    if (IS_RESIZING_ENABLED) {
        await image.preprocess({
            resize: {
                width: 1920,
            },
        });
    }

    await image.decoded;

    const encodeOptions = {
        webp: {
            quality: 25,
            target_size: 0,
            target_PSNR: 0,
            method: 6,
            sns_strength: 50,
            filter_strength: 60,
            filter_sharpness: 0,
            filter_type: 1,
            partitions: 0,
            segments: 4,
            pass: 1,
            show_compressed: 0,
            preprocessing: 0,
            autofilter: 0,
            partition_limit: 0,
            alpha_compression: 1,
            alpha_filtering: 1,
            alpha_quality: 100,
            lossless: 0,
            exact: 0,
            image_hint: 0,
            emulate_jpeg_size: 0,
            thread_level: 0,
            low_memory: 0,
            near_lossless: 100,
            use_delta_palette: 0,
            use_sharp_yuv: 0,
        },
    };

    console.log(`squooshing ${filename} ...`);
    await image.encode(encodeOptions);

    const rawEncodedImage = (await image.encodedWith.webp).binary;
    const squooshedFilename = generateSquooshedFilename(filename);
    const filePath = SQUOOSHED_FOLDER + squooshedFilename;
    const folderPath = path.dirname(filePath);

    fs.mkdirSync(folderPath, {recursive: true});
    fs.writeFileSync(filePath, rawEncodedImage);
};

const generateSquooshedFilename = (file) => {
    if (!IS_CHANGING_EXTENSION_ENABLED) return file;

    const originalExtension = path.extname(file);
    return file.substring(0, file.length - originalExtension.length) + '.webp';
};

const main = async () => {
    console.log('cleaning squooshed folder ...');
    cleanSquooshedFolder();
    console.log('squooshed folder has been cleaned successfully.');
    console.log();

    const filesWithOriginalFolder = generateFilenames(ORIGINAL_FOLDER);
    const files = filesWithOriginalFolder.map((x) => x.split(path.sep).slice(1).join(path.sep));

    const promises = [];
    for (const file of files) promises.push(squooshImage(file));
    await Promise.all(promises);

    await imagePool.close();
};

main().then(() => {
    console.log('Done!');
    process.exit(0);
});
