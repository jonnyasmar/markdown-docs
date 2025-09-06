import { DiffSourceToggleWrapper } from '@mdxeditor/editor';
import { memo } from 'react';

export const DiffViewWrapper = memo(
  ({
    children,
    shouldShow = false,
    currentViewMode,
  }: {
    children: React.ReactNode;
    shouldShow?: boolean;
    currentViewMode?: 'rich-text' | 'source' | 'diff';
  }): React.ReactElement => {
    return shouldShow || currentViewMode !== 'rich-text' ? (
      <DiffSourceToggleWrapper options={['rich-text', 'source']}>{children}</DiffSourceToggleWrapper>
    ) : (
      <>{children}</>
    );
  },
);
