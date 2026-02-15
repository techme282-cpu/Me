import { useNavigate } from "react-router-dom";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export default function LinkifyText({ text, className }: { text: string; className?: string }) {
  const navigate = useNavigate();
  const origin = window.location.origin;

  const parts = text.split(URL_REGEX);

  const handleClick = (url: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (url.startsWith(origin)) {
      const path = url.replace(origin, "");
      navigate(path);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <span className={className}>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            onClick={(e) => handleClick(part, e)}
            className="text-primary underline break-all hover:opacity-80"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}
