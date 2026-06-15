// Mock of the supabase Storage surface. Fixture rows already hold full hosted
// image URLs in their path columns, so getPublicUrl/createSignedUrl just echo
// them back. Uploads/removes succeed without persisting binary data.

export function mockStorage() {
  const resolveUrl = (path: string) =>
    path.startsWith("http") ? path : `/demo/${path.replace(/^\/+/, "")}`;

  return {
    from(_bucket: string) {
      return {
        getPublicUrl(path: string) {
          return { data: { publicUrl: resolveUrl(path) } };
        },
        async createSignedUrl(path: string) {
          return { data: { signedUrl: resolveUrl(path) }, error: null };
        },
        async upload(path: string) {
          return { data: { path, id: path, fullPath: `${_bucket}/${path}` }, error: null };
        },
        async remove() {
          return { data: [], error: null };
        },
        async list() {
          return { data: [], error: null };
        },
      };
    },
  };
}
