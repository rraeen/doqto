import { cn } from '../cn';
import { UserRoundIcon } from './user-round-icon';

/** Round green-bordered doctor avatar, with an optional presence dot. */
export function Avatar({
  className,
  online,
  src,
}: {
  /** The person's photo; the generic figure shows when there is none. */
  src?: string | null;
  className?: string;
  /** `true` green dot, `false` grey dot, `undefined` none. */
  online?: boolean;
}) {
  return (
    <span aria-hidden className={cn('relative inline-flex shrink-0', className ?? 'size-14')}>
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full border-2 border-brand-500 bg-brand-500/10 text-brand-700">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <UserRoundIcon className="size-full max-h-[75%] max-w-[75%]" />
        )}
      </span>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-surface',
            online ? 'bg-brand-500' : 'bg-ink-muted/40',
          )}
        />
      )}
    </span>
  );
}
