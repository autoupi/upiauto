import Swal from "sweetalert2";

export function swalSuccess(title: string) {
  return Swal.fire({
    title,
    icon: "success",
    draggable: true,
  });
}

export { Swal };
