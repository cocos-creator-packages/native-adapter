/****************************************************************************
 Copyright (c) 2013-2016 Chukong Technologies Inc.
 Copyright (c) 2017-2018 Xiamen Yaji Software Co., Ltd.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Xiamen Yaji Software Co., Ltd. reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

'use strict';

const cacheManager = require('./jsb-cache-manager');
const { downloadFile, readText, readArrayBuffer, readJson } = require('./jsb-fs-utils');

const REGEX = /^\w+:\/\/.*/;
const downloader = cc.assetManager.downloader;
const parser = cc.assetManager.parser;
const presets = cc.assetManager.presets;
downloader.maxConcurrency = 30;
downloader.maxRequestsPerFrame = 60;
presets['preload'].maxConcurrency = 15;
presets['preload'].maxRequestsPerFrame = 30;
presets['scene'].maxConcurrency = 32;
presets['scene'].maxRequestsPerFrame = 64;
presets['bundle'].maxConcurrency = 32;
presets['bundle'].maxRequestsPerFrame = 64;
let suffix = 0;

let REMOTE_SERVER_ROOT = '';
let remoteBundles = {};

const loadedScripts = {};

function downloadScript (url, options, onComplete) {
    if (typeof options === 'function') {
        onComplete = options;
        options = null;
    }

    if (loadedScripts[url]) return onComplete && onComplete();

    download(url, function (src, options, onComplete) {
        window.require(src);
        loadedScripts[url] = true;
        onComplete && onComplete(null);
    }, options, options.onFileProgress, onComplete);
}

function download (url, func, options, onFileProgress, onComplete) {
    var result = transformUrl(url, options);
    if (result.inLocal) {
        func(result.url, options, onComplete);
    }
    else if (result.inCache) {
        cacheManager.updateLastTime(url)
        func(result.url, options, function (err, data) {
            if (err) {
                cacheManager.removeCache(url);
            }
            onComplete(err, data);
        });
    }
    else {
        var time = Date.now();
        var storagePath = '';
        if (options.__cacheBundleRoot__) {
            storagePath = `${cacheManager.cacheDir}/${options.__cacheBundleRoot__}/${time}${suffix++}${cc.path.extname(url)}`;
        }
        else {
            storagePath = `${cacheManager.cacheDir}/${time}${suffix++}${cc.path.extname(url)}`;
        }
        downloadFile(url, storagePath, options.header, onFileProgress, function (err, path) {
            if (err) {
                onComplete(err, null);
                return;
            }
            func(path, options, function (err, data) {
                if (!err) {
                    cacheManager.cacheFile(url, storagePath, options.__cacheBundleRoot__);
                }
                onComplete(err, data);
            });
        });
    }
}

function transformUrl (url, options) {
    var inLocal = false;
    var inCache = false;
    if (REGEX.test(url)) {
        if (options.reload) {
            return { url };
        }
        else {
            var cache = cacheManager.cachedFiles.get(url);
            if (cache) {
                inCache = true;
                url = cache.url;
            }
        }
    }
    else {
        inLocal = true;
    }
    return { url, inLocal, inCache };
}

function doNothing (content, options, onComplete) {
    onComplete(null, content);
}

function downloadAsset (url, options, onComplete) {
    download(url, doNothing, options, options.onFileProgress, onComplete);
}

function _getFontFamily (fontHandle) {
    var ttfIndex = fontHandle.lastIndexOf(".ttf");
    if (ttfIndex === -1) return fontHandle;

    var slashPos = fontHandle.lastIndexOf("/");
    var fontFamilyName;
    if (slashPos === -1) {
        fontFamilyName = fontHandle.substring(0, ttfIndex) + "_LABEL";
    } else {
        fontFamilyName = fontHandle.substring(slashPos + 1, ttfIndex) + "_LABEL";
    }
    if (fontFamilyName.indexOf(' ') !== -1) {
        fontFamilyName = '"' + fontFamilyName + '"';
    }
    return fontFamilyName;
}

function parseText (url, options, onComplete) {
    readText(url, onComplete);
}

function parseJson (url, options, onComplete) {
    readJson(url, onComplete);
}

function downloadText (url, options, onComplete) {
    download(url, parseText, options, options.onFileProgress, onComplete);
}

function parseArrayBuffer (url, options, onComplete) {
    readArrayBuffer(url, onComplete);
}

function downloadJson (url, options, onComplete) {
    download(url, parseJson, options, options.onFileProgress, onComplete);
} 

function downloadBundle (nameOrUrl, options, onComplete) {
    let bundleName = cc.path.basename(nameOrUrl);
    var version = options.version || cc.assetManager.downloader.bundleVers[bundleName];
    let url;
    if (REGEX.test(nameOrUrl)) {
        url = nameOrUrl;
        cacheManager.makeBundleFolder(bundleName);
    }
    else {
        if (remoteBundles[bundleName]) {
            url = `${REMOTE_SERVER_ROOT}remote/${bundleName}`;
            cacheManager.makeBundleFolder(bundleName);
        }
        else {
            url = `assets/${bundleName}`;
        }
    }
    var config = `${url}/config.${version ? version + '.': ''}json`;
    options.__cacheBundleRoot__ = bundleName;
    downloadJson(config, options, function (err, response) {
        if (err) {
            return onComplete(err, null);
        }
        let out = response;
        out && (out.base = url + '/');

        var js = `${url}/index.${version ? version + '.' : ''}${out.encrypted ? 'jsc' : `js`}`;
        downloadScript(js, options, function (err) {
            if (err) {
                return onComplete(err, null);
            }
            onComplete(err, out);
        });
    });
};

function loadFont (url, options, onComplete) {
    let fontFamilyName = _getFontFamily(url);

    let fontFace = new FontFace(fontFamilyName, "url('" + url + "')");
    document.fonts.add(fontFace);

    fontFace.load();
    fontFace.loaded.then(function() {
        onComplete(null, fontFamilyName);
    }, function () {
        cc.warnID(4933, fontFamilyName);
        onComplete(null, fontFamilyName);
    });
}

parser.parsePVRTex = downloader.downloadDomImage;
parser.parsePKMTex = downloader.downloadDomImage;
downloader.downloadScript = downloadScript;

downloader.register({
    // JS
    '.js' : downloadScript,
    '.jsc' : downloadScript,

    // Images
    '.png' : downloadAsset,
    '.jpg' : downloadAsset,
    '.bmp' : downloadAsset,
    '.jpeg' : downloadAsset,
    '.gif' : downloadAsset,
    '.ico' : downloadAsset,
    '.tiff' : downloadAsset,
    '.webp' : downloadAsset,
    '.image' : downloadAsset,
    '.pvr' : downloadAsset,
    '.pkm' : downloadAsset,

    // Audio
    '.mp3' : downloadAsset,
    '.ogg' : downloadAsset,
    '.wav' : downloadAsset,
    '.m4a' : downloadAsset,

    // Video
    '.mp4': downloadAsset,
    '.avi': downloadAsset,
    '.mov': downloadAsset,
    '.mpg': downloadAsset,
    '.mpeg': downloadAsset,
    '.rm': downloadAsset,
    '.rmvb': downloadAsset,
    // Text
    '.txt' : downloadAsset,
    '.xml' : downloadAsset,
    '.vsh' : downloadAsset,
    '.fsh' : downloadAsset,
    '.atlas' : downloadAsset,

    '.tmx' : downloadAsset,
    '.tsx' : downloadAsset,
    '.fnt' : downloadAsset,

    '.json' : downloadJson,
    '.ExportJson' : downloadAsset,

    '.binary' : downloadAsset,
    '.bin' : downloadAsset,
    '.dbbin': downloadAsset,
    '.skel': downloadAsset,

    // Font
    '.font' : downloadAsset,
    '.eot' : downloadAsset,
    '.ttf' : downloadAsset,
    '.woff' : downloadAsset,
    '.svg' : downloadAsset,
    '.ttc' : downloadAsset,

    'bundle': downloadBundle,

    '.plist' : downloadText,
    'default': downloadText
});

parser.register({
    
    // Images
    '.png' : downloader.downloadDomImage,
    '.jpg' : downloader.downloadDomImage,
    '.bmp' : downloader.downloadDomImage,
    '.jpeg' : downloader.downloadDomImage,
    '.gif' : downloader.downloadDomImage,
    '.ico' : downloader.downloadDomImage,
    '.tiff' : downloader.downloadDomImage,
    '.webp' : downloader.downloadDomImage,
    '.image' : downloader.downloadDomImage,
    // compressed texture
    '.pvr': downloader.downloadDomImage,
    '.pkm': downloader.downloadDomImage,

    '.binary' : parseArrayBuffer,
    '.bin' : parseArrayBuffer,
    '.dbbin': parseArrayBuffer,
    '.skel': parseArrayBuffer,

    // Text
    '.txt' : parseText,
    '.xml' : parseText,
    '.vsh' : parseText,
    '.fsh' : parseText,
    '.atlas' : parseText,
    '.tmx' : parseText,
    '.tsx' : parseText,
    '.fnt' : parseText,

    // Font
    '.font' : loadFont,
    '.eot' : loadFont,
    '.ttf' : loadFont,
    '.woff' : loadFont,
    '.svg' : loadFont,
    '.ttc' : loadFont,

    '.ExportJson' : parseJson,
});

cc.assetManager.transformPipeline.append(function (task) {
    var input = task.output = task.input;
    for (var i = 0, l = input.length; i < l; i++) {
        var item = input[i];
        if (item.config) {
            item.options.__cacheBundleRoot__ = item.config.name;
        }
    }
});

var originInit = cc.assetManager.init;
cc.assetManager.init = function (options) {
    originInit.call(cc.assetManager, options);
    options.remoteBundles && options.remoteBundles.forEach(x => remoteBundles[x] = true);
    REMOTE_SERVER_ROOT = options.server || '';
    if (REMOTE_SERVER_ROOT && !REMOTE_SERVER_ROOT.endsWith('/')) REMOTE_SERVER_ROOT += '/';
    cacheManager.init();
};