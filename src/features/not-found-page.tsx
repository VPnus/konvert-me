import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { ru } from '@/i18n/ru';

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{ru.pages.notFound.title}</h1>
      <p className="text-sm text-muted-foreground">{ru.pages.notFound.subtitle}</p>
      <Link to="/overview" className={buttonVariants()}>
        {ru.pages.notFound.action}
      </Link>
    </section>
  );
}
