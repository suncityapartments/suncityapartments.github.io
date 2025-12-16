import { Component, computed, HostBinding, HostListener, signal } from '@angular/core';

@Component({
  selector: '.saoa-qr',
  templateUrl: './qr.component.html',
  styleUrl: './qr.component.scss',
})
export class QRComponent {
  protected isDragOver = false;
  protected imageSrc: string | ArrayBuffer | null = null;
  protected selectedFile = signal<File | null>(null);
  protected selectedFileName = computed(() => this.selectedFile() ? this.getFileNameWithoutExtension(this.selectedFile()?.name) : 'no qr code');

  @HostBinding('class.no-print')
  get color() {
    return !this.selectedFile();
  }

  getFileNameWithoutExtension(filename?: string): string {
    if (!filename) return '';

    // Handle hidden files (starting with dot)
    if (filename.startsWith('.')) {
      const parts = filename.split('.');

      // If only one dot at start (like '.gitignore')
      if (parts.length === 2 && parts[0] === '') {
        return filename;
      }
    }

    const lastDotIndex = filename.lastIndexOf('.');

    return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent) {
    // Prevent default to allow drop
    if (this.isImageFile(event)) {
      event.preventDefault();
    }
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(event: DragEvent) {
    // Prevent default behavior (open as link)
    if (this.isImageFile(event)) {
      event.preventDefault();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (this.isImageFile(event)) {
      this.isDragOver = true;
    }
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      const file = input.files[0];
      this.handleFile(file);
    }
  }

  private handleFile(file: File) {
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please drop an image file only!');

      return;
    }

    // Check file size (optional, 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');

      return;
    }

    this.selectedFile.set(file);

    // Create a FileReader to read the file
    const reader = new FileReader();

    reader.onload = (e) => {
      this.imageSrc = e.target?.result || null;
    };

    reader.onerror = () => {
      alert('Failed to read the file');
    };

    reader.readAsDataURL(file);
  }

  private isImageFile(event: DragEvent): boolean {
    if (!event.dataTransfer?.items) return false;

    for (let i = 0; i < event.dataTransfer.items.length; i++) {
      if (event.dataTransfer.items[i].type.indexOf('image') !== -1) {
        return true;
      }
    }

    return false;
  }
}
