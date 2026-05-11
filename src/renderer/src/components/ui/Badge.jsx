import { cx } from '../../lib/utils.js';

const TONES = {
  zinc:   'bg-zinc-100 text-zinc-600 border-zinc-200',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:  'bg-amber-50 text-amber-700 border-amber-200',
  red:    'bg-rose-50 text-rose-700 border-rose-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

export function Badge({ tone = 'zinc', children, className = '' }) {
  return <span className={cx('badge', TONES[tone] || TONES.zinc, className)}>{children}</span>;
}
