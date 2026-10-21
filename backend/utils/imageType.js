// The real type of an image from its first bytes (its "magic number"), so a
// renamed or corrupted file is refused before any storage provider is called.
// Covers exactly the types in IMAGE_MIME_TYPES; returns null for anything else.
// Reads at most 12 bytes - no library, no copy of the buffer.
const detectImageType = (buffer) => {
    try {
        if (!buffer || buffer.length < 12) return null;
        // JPEG: FF D8 FF
        if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (buffer[0] === 0x89 && buffer.toString('latin1', 1, 4) === 'PNG' && buffer[4] === 0x0d && buffer[5] === 0x0a) return 'image/png';
        // GIF: "GIF87a" / "GIF89a"
        const gif = buffer.toString('latin1', 0, 6);
        if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
        // WebP: "RIFF" ???? "WEBP"
        if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
        return null;
    } catch (err) {
        throw err;
    }
};

module.exports = { detectImageType };
