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
const cacheManager = require('./jsb-cache-manager');

let Audio = cc._Audio = function (src) {
    this.src = src;
    this.volume = 1;
    this.loop = false;
    this.id = -1;
};

let handleVolume  = function (volume) {
    if (volume === undefined) {
        // set default volume as 1
        volume = 1;
    }
    else if (typeof volume === 'string') {
        volume = Number.parseFloat(volume);
    }
    return volume;
};

(function (proto, audioEngine) {
    if (!audioEngine) return;
    
    // Using the new audioEngine
    cc.audioEngine = audioEngine;
    audioEngine.setMaxWebAudioSize = function () { };

    Audio.State = audioEngine.AudioState;

    proto.play = function () {
        audioEngine.stop(this.id);

        let clip = this.src;
        this.id = audioEngine.play(clip, this.loop, this.volume);
    };

    proto.pause = function () {
        audioEngine.pause(this.id);
    };

    proto.resume = function () {
        audioEngine.resume(this.id);
    };

    proto.stop = function () {
        audioEngine.stop(this.id);
    };

    proto.destroy = function () {

    };

    proto.setLoop = function (loop) {
        this.loop = loop;
        audioEngine.setLoop(this.id, loop);
    };

    proto.getLoop = function () {
        return this.loop;
    };

    proto.setVolume = function (volume) {
        volume = handleVolume(volume);
        this.volume = volume;
        return audioEngine.setVolume(this.id, volume);
    };

    proto.getVolume = function () {
        return this.volume;
    };

    proto.setCurrentTime = function (time) {
        audioEngine.setCurrentTime(this.id, time);
    };

    proto.getCurrentTime = function () {
        return audioEngine.getCurrentTime(this.id)
    };

    proto.getDuration = function () {
        return audioEngine.getDuration(this.id)
    };

    proto.getState = function () {
        return audioEngine.getState(this.id)
    };

    // polyfill audioEngine

    var _music = {
        id: -1,
        clip: '',
        loop: false,
        volume: 1
    };
    var _effect = {
        idArray: [],
        volume: 1
    };

    audioEngine.play = function (clip, loop, volume) {
        if (typeof volume !== 'number') {
            volume = 1;
        }
        let audioFilePath;
        if (typeof clip === 'string') {
            // backward compatibility since 1.10
            cc.warnID(8401, 'cc.audioEngine', 'cc.AudioClip', 'AudioClip', 'cc.AudioClip', 'audio');
            audioFilePath = clip;
        }
        else {
            if (clip.loaded) {
                audioFilePath = clip._nativeAsset;
            }
            else {
                // audio delay loading
                clip._nativeAsset = audioFilePath = cacheManager.getCache(clip.nativeUrl) || clip.nativeUrl;
                clip.loaded  = true;
            }
        }
        return audioEngine.play2d(audioFilePath, loop, volume);
    };
    audioEngine.playMusic = function (clip, loop) {
        audioEngine.stop(_music.id);
        _music.id = audioEngine.play(clip, loop, _music.volume);
        _music.loop = loop;
        _music.clip = clip;
        return _music.id;
    };
    audioEngine.stopMusic = function () {
        audioEngine.stop(_music.id);
    };
    audioEngine.pauseMusic = function () {
        audioEngine.pause(_music.id);
        return _music.id;
    };
    audioEngine.resumeMusic = function () {
        audioEngine.resume(_music.id);
        return _music.id;
    };
    audioEngine.getMusicVolume = function () {
        return _music.volume;
    };
    audioEngine.setMusicVolume = function (volume) {
        _music.volume = handleVolume(volume);
        audioEngine.setVolume(_music.id, _music.volume);
        return volume;
    };
    audioEngine.isMusicPlaying = function () {
        return audioEngine.getState(_music.id) === audioEngine.AudioState.PLAYING;
    };
    audioEngine.playEffect = function (filePath, loop) {
        var effectId = audioEngine.play(filePath, loop || false, _effect.volume);
        _effect.idArray.push(effectId);
        return effectId;
    };
    audioEngine.setEffectsVolume = function (volume) {
        _effect.volume = handleVolume(volume);
    };
    audioEngine.getEffectsVolume = function () {
        return _effect.volume;
    };
    audioEngine.pauseEffect = function (audioID) {
        return audioEngine.pause(audioID);
    };
    audioEngine.pauseAllEffects = function () {
        var length = _effect.idArray.length;
        for (var i = 0; i < length; i++) {
            audioEngine.pause(_effect.idArray[i]);
        }
    };
    audioEngine.resumeEffect = function (id) {
        audioEngine.resume(id);
    };
    audioEngine.resumeAllEffects = function () {
        var length = _effect.idArray.length;
        for (var i = 0; i < length; i++) {
            audioEngine.resume(_effect.idArray[i]);
        }
    };
    audioEngine.stopEffect = function (id) {
        var length = _effect.idArray.length;
        for (var i = 0; i < length; i++) {
            if (_effect.idArray[i] === id) {
                _effect.idArray.slice(i, id);
            }
        }
        return audioEngine.stop(id);
    };
    audioEngine.stopAllEffects = function () {
        var length = _effect.idArray.length;
        for (var i = 0; i < length; i++) {
            audioEngine.stop(_effect.idArray[i]);
        }
        _effect.idArray = [];
    };

    // Unnecessary on native platform
    audioEngine._break = function () {};
    audioEngine._restore = function () {};

    // deprecated

    audioEngine._uncache = audioEngine.uncache;
    audioEngine.uncache = function (clip) {
        var path;
        if (typeof clip === 'string') {
            // backward compatibility since 1.10
            cc.warnID(8401, 'cc.audioEngine', 'cc.AudioClip', 'AudioClip', 'cc.AudioClip', 'audio');
            path = clip;
        }
        else {
            if (!clip) {
                return;
            }
            path = clip._nativeAsset;
        }
        audioEngine._uncache(path);
    };

    audioEngine._preload = audioEngine.preload;
    audioEngine.preload = function (filePath, callback) {
        cc.warn('`cc.audioEngine.preload` is deprecated, use `cc.assetManager.loadRes(url, cc.AudioClip)` instead please.');
        audioEngine._preload(filePath, callback);
    };

})(Audio.prototype, jsb.AudioEngine);
