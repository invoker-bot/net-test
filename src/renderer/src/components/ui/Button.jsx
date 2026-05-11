import { cx } from '../../lib/utils.js';

export function Button({ variant = 'default', size = 'sm', className = '', ...p }) {
  const v = variant === 'primary' ? 'btn-primary'
          : variant === 'ghost'   ? 'btn-ghost'
          : '';
  const s = size === 'xs' ? 'h-6 px-2 text-[11px]'
          : size === 'md' ? 'h-8 px-3 text-[12.5px]'
          : '';
  return <button {...p} className={cx('btn ring-accent', v, s, className)} />;
}
