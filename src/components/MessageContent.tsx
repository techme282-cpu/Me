import LinkifyText from "./LinkifyText";

interface MessageContentProps {
  content: string;
  className?: string;
  isMine?: boolean;
}

export default function MessageContent({ content, className, isMine }: MessageContentProps) {
  // Detect sticker messages
  const stickerMatch = content.match(/^\[STICKER:(.*?)\]$/);
  if (stickerMatch) {
    const url = stickerMatch[1];
    return (
      <img
        src={url}
        alt="sticker"
        className="w-24 h-24 object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return <LinkifyText text={content} className={className} />;
}
