import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Image, Video, Type, Send, ArrowLeft, Hash, Upload, X } from "lucide-react";

export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (mediaType === "image" && !isImage) {
      toast.error("Sélectionne une image");
      return;
    }
    if (mediaType === "video" && !isVideo) {
      toast.error("Sélectionne une vidéo");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 50MB)");
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!content && !mediaFile) {
      toast.error("Ajoute du contenu");
      return;
    }

    setLoading(true);
    const tags = hashtags.split(/[\s,#]+/).filter(Boolean);

    let mediaUrl: string | null = null;

    if (mediaFile) {
      const ext = mediaFile.name.split(".").pop();
      const path = `${user.id}/post_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("media").upload(path, mediaFile);
      if (uploadError) {
        toast.error("Erreur upload: " + uploadError.message);
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      mediaUrl = urlData.publicUrl;
    }

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      content,
      media_url: mediaUrl,
      media_type: mediaFile ? mediaType : "text",
      hashtags: tags,
    });

    setLoading(false);
    if (error) {
      toast.error("Erreur: " + error.message);
      return;
    }
    toast.success("Publication créée ! 🔥");
    navigate("/");
  };

  const mediaTypes = [
    { type: "text" as const, icon: Type, label: "Texte" },
    { type: "image" as const, icon: Image, label: "Image" },
    { type: "video" as const, icon: Video, label: "Vidéo" },
  ];

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={22} />
          </button>
          <h2 className="font-display font-bold text-foreground">Nouvelle publication</h2>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="gradient-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send size={14} />
            {loading ? "..." : "Publier"}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Media type selector */}
        <div className="flex gap-2">
          {mediaTypes.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => { setMediaType(type); if (type === "text") clearMedia(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                mediaType === type
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Qu'est-ce qui se passe ? 🔥"
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-none"
          maxLength={1000}
        />

        {/* Media upload */}
        {mediaType !== "text" && (
          <div className="space-y-3">
            {mediaPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                {mediaType === "image" ? (
                  <img src={mediaPreview} alt="Aperçu" className="w-full max-h-80 object-contain bg-secondary" />
                ) : (
                  <video src={mediaPreview} className="w-full max-h-80 object-contain bg-secondary" controls />
                )}
                <button
                  onClick={clearMedia}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 text-foreground hover:bg-background"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              >
                <Upload size={28} />
                <span className="text-sm font-medium">
                  {mediaType === "image" ? "Choisir une image" : "Choisir une vidéo"}
                </span>
                <span className="text-xs">Max 50MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={mediaType === "image" ? "image/*" : "video/*"}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* Hashtags */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Hash size={12} /> Hashtags
          </label>
          <input
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="purge gaming vibe"
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
