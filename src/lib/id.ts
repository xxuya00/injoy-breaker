export function generateId(nick: string): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${nick}-${suffix}`;
}

export function nickFromId(id: string): string {
  return id.replace(/-\d{4}$/, '');
}
