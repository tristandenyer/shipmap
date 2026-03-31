import { createUploadthing } from 'uploadthing/server';

const f = createUploadthing();

export const uploadRouter = {
  avatar: f({ image: { maxFileSize: '4MB' } })
    .onUploadComplete(({ file }) => {
      console.log('Upload complete:', file.url);
    }),
  document: f({ pdf: { maxFileSize: '16MB' } })
    .onUploadComplete(({ file }) => {
      console.log('Document uploaded:', file.url);
    }),
};
