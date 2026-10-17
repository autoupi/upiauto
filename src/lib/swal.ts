import Swal from "sweetalert2";

export function swalSuccess(title: string) {
  return Swal.fire({
    title,
    icon: "success",
    confirmButtonText: "OK",
    draggable: true,
  });
}

export function swalError(title: string, text?: string) {
  return Swal.fire({
    title,
    text,
    icon: "error",
    confirmButtonText: "OK",
    draggable: true,
  });
}

export { Swal };
