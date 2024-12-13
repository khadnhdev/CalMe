function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu tiếng Việt
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') +
    '-' +
    Math.random().toString(36).substring(2, 8);
}

module.exports = {
  generateSlug
}; 