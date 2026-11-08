export const ADMIN_TICKET_RETURN_COOKIE = 'haratna-admin-ticket-return';

export function adminTicketPath(path: string | undefined): string | undefined {
  return path && /^\/admin\/tickets\/[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(path) ? path : undefined;
}
