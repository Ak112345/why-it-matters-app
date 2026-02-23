// Temporary local test for storage download
import { downloadFile } from '../src/utils/storage';

async function testDownload() {
  const bucket = 'segmented_clips';
  const filePath = '0272947d-dd23-4166-9d88-498e7210b04e/segment-000.mp4';
  try {
    const blob = await downloadFile(bucket, filePath);
    if (blob) {
      console.log('Download succeeded:', filePath);
    } else {
      console.error('Download failed: No data returned');
    }
  } catch (err) {
    console.error('Download error:', err);
  }
}

testDownload();
