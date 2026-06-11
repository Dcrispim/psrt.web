import {
  forwardRef,
  useEffect,
  useState,
  type ImgHTMLAttributes,
  type SyntheticEvent,
} from 'react';
import { NOT_FOUND_IMAGE_SRC } from '../lib/notFoundImage';

type FallbackImageProps = ImgHTMLAttributes<HTMLImageElement>;

export const FallbackImage = forwardRef<HTMLImageElement, FallbackImageProps>(
  function FallbackImage({ src, onError, ...props }, ref) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      setFailed(false);
    }, [src]);

    const displaySrc =
      src && !failed ? src : NOT_FOUND_IMAGE_SRC;

    const handleError = (e: SyntheticEvent<HTMLImageElement>) => {
      if (src && !failed) {
        setFailed(true);
      }
      onError?.(e);
    };

    return (
      <img
        ref={ref}
        src={displaySrc}
        onError={handleError}
        {...props}
      />
    );
  },
);
