interface PortfolioImage {
  id: string;
  url: string;
}

interface PortfolioGridProps {
  images: PortfolioImage[];
}

export function PortfolioGrid({ images }: PortfolioGridProps) {
  if (images.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {images.map((image) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={image.id}
          src={image.url}
          loading="lazy"
          className="w-full aspect-[4/3] object-cover rounded-lg"
          alt=""
        />
      ))}
    </div>
  );
}
