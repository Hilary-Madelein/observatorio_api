'use strict';
const multer = require('multer');
const path = require('path');
const uuid = require('uuid');

const createStorage = (baseDir, folderPath) => {
    return multer.diskStorage({
        destination: path.join(__dirname, '../public', baseDir, folderPath),
        filename: (req, file, cb) => {
            const parts = file.originalname.split('.');
            const extension = parts[parts.length - 1];
            cb(null, uuid.v4() + "." + extension);
        }
    });
};

const extensionesAceptadasFoto = (req, file, cb) => {
    const allowedExtensions = ['.jpeg', '.jpg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos JPEG, JPG y PNG.'), false);
    }
};

const extensionesAceptadasIcono = (req, file, cb) => {
    const allowedExtensions = ['.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PNG.'), false);
    }
};

const extensionesAceptadasTexto = (req, file, cb) => {
    const allowedExtensions = ['.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos TXT.'), false);
    }
};

const upload = (baseDir, folder, type = 'image') => {
    const storage = createStorage(baseDir, folder);
    let filter;
    if (type === 'icon') filter = extensionesAceptadasIcono;
    else if (type === 'text') filter = extensionesAceptadasTexto;
    else filter = extensionesAceptadasFoto;

    return multer({
        storage: storage,
        fileFilter: filter,
        limits: { fileSize: 5 * 1024 * 1024 }
    });
};

const microbasinStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'coordenadas') {
            cb(null, path.join(__dirname, '../public/data/microcuencas'));
        } else {
            cb(null, path.join(__dirname, '../public/images/microcuencas'));
        }
    },
    filename: (req, file, cb) => {
        const parts = file.originalname.split('.');
        const extension = parts[parts.length - 1];
        cb(null, uuid.v4() + "." + extension);
    }
});

const microbasinFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'coordenadas') {
        if (['.txt'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos TXT para coordenadas.'), false);
        }
    } else {
        const allowedExtensions = ['.jpeg', '.jpg', '.png'];
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos JPEG, JPG y PNG para foto.'), false);
        }
    }
};

const uploadMicrobasinFiles = multer({
    storage: microbasinStorage,
    fileFilter: microbasinFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = {
    uploadFotoPersona: upload('images', 'users'),
    uploadFotoMicrocuenca: uploadMicrobasinFiles,
    uploadFotoEstacion: upload('images', 'estaciones'),
    uploadIconoEstacion: upload('images', 'icons_estaciones', 'icon'),
    uploadCoordenadasMicrocuenca: upload('data', 'microcuencas', 'text')
};
