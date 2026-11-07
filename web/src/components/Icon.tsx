import {
  Ban,
  CalendarDays,
  ChartColumn,
  Flag,
  HandHeart,
  House,
  Lightbulb,
  Lock,
  Mail,
  MapPinned,
  Megaphone,
  MessagesSquare,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  home: House,
  megaphone: Megaphone,
  calendar: CalendarDays,
  search: Search,
  hand: HandHeart,
  chart: ChartColumn,
  message: MessagesSquare,
  store: Store,
  user: UserRound,
  map: MapPinned,
  flag: Flag,
  ban: Ban,
  lock: Lock,
  wrench: Wrench,
  trash: Trash2,
  lightbulb: Lightbulb,
  shield: ShieldCheck,
  mail: Mail,
};

export function Icon({ name, className = 'size-5' }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? ShieldCheck;
  return <Cmp className={className} aria-hidden="true" strokeWidth={1.8} />;
}
