import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

/**
 * Generates a PDF from an HTML element
 * @param elementId The ID of the HTML element to capture
 * @param filename The desired output filename (without .pdf)
 */
export const generatePDF = async (elementId: string, filename: string) => {
    const element = document.getElementById(elementId);
    
    if (!element) {
        toast.error('Could not find document to print');
        return;
    }

    // Capture the element as a canvas
    // scale: 2 improves resolution on high DPI screens
    try {
        const canvas = await html2canvas(element, { 
            scale: 2,
            useCORS: true, 
            logging: false,
            // Ensure background is specifically white if transparent
            backgroundColor: 'var(--card-bg)'
        });

        const imgData = canvas.toDataURL('image/png');

        // A4 Paper proportions: 210 x 297 mm
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // Add the image to the PDF
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        // Save the generated document
        pdf.save(`${filename}.pdf`);
        
    } catch (err: any) {
        console.error('PDF Generation Error:', err);
        toast.error('Failed to generate PDF document');
    }
};
