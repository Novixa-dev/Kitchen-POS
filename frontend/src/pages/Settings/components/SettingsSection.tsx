import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/atoms/card';

interface Props {
  title: string;
  description?: string;
  /** Renders the title in the danger colour, for destructive sections. */
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}

/**
 * One settings card.
 *
 * The page was a single 550-line component with ten inlined cards, so every
 * section re-rendered on any state change and none could be tested on its own.
 * Each concern is now its own component; this is their shared frame.
 */
export const SettingsSection: React.FC<Props> = ({
  title,
  description,
  tone = 'default',
  children,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className={tone === 'danger' ? 'text-danger' : undefined}>{title}</CardTitle>
      {description && <p className="text-sm text-subtle mt-1">{description}</p>}
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>
);
