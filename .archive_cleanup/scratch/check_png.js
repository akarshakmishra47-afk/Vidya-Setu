const fs = require('fs');

function hasTransparency(filePath) {
    // A quick hack to check if the PNG has an alpha channel
    // PNG header: 89 50 4E 47 0D 0A 1A 0A
    // IHDR chunk: length (4 bytes), type (4 bytes 'IHDR'), data (13 bytes), CRC (4 bytes)
    // IHDR data: width (4), height (4), bit depth (1), color type (1), compression (1), filter (1), interlace (1)
    // Color type 6 is RGBA, color type 4 is Grayscale+Alpha
    const buffer = fs.readFileSync(filePath);
    if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        console.log(filePath, 'is not a PNG');
        return;
    }
    
    // IHDR is the first chunk, starts at offset 8. Length is 4 bytes, Type is 4 bytes.
    // Data starts at offset 16.
    // Color type is at offset 16 + 8 + 1 = 25
    const colorType = buffer[25];
    if (colorType === 6 || colorType === 4) {
        console.log(filePath, 'HAS alpha channel (colorType', colorType, ')');
    } else {
        console.log(filePath, 'NO alpha channel (colorType', colorType, ')');
    }
}

hasTransparency('C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\c19603c2-eea8-4059-af76-1df0d1607b09\\.user_uploaded\\media_1789076527991.png');
hasTransparency('C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\c19603c2-eea8-4059-af76-1df0d1607b09\\.user_uploaded\\media_1789076528121.png');
hasTransparency('C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\c19603c2-eea8-4059-af76-1df0d1607b09\\.user_uploaded\\media_1789076528210.png');
hasTransparency('C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\c19603c2-eea8-4059-af76-1df0d1607b09\\.user_uploaded\\media_1789076563938.png');
