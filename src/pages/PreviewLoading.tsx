import GeneratingStep from "@/components/onboarding/GeneratingStep";
import { useSearchParams } from "react-router-dom";

const PreviewLoading = () => {
  const [params] = useSearchParams();
  const name = params.get("name") || "friend";
  return <GeneratingStep userName={name} previewMode />;
};

export default PreviewLoading;
